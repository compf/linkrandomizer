import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import {
    generateUrlBatch,
    type InducedSchemaRecord,
    type InducedSiteKind,
    type Website,
} from "@linkrandomizer/common";
import { getCrawlStore, EXTRACTED_URLS_DIR, type CrawlStore } from "../storage/crawl-store.js";
import { DomainScheduler } from "../crawler/domain-scheduler.js";
import { extractLinks } from "../crawler/fetch-pipeline.js";

// Structured-output schemas: strict mode forbids optional fields, so these are
// deliberately plain (no z.function/z.optional like the full WebsiteSchema).
const InducedUrlPart = z.union([
    z.string().describe("Fixed URL fragment"),
    z.object({
        variable: z.string(),
        padding: z
            .number()
            .nullable()
            .describe("Zero-pad the value to this width (e.g. 2 for months), null for none"),
    }),
]);

const InducedVariable = z.union([
    z.object({
        name: z.literal("randomFromRange"),
        min: z.number(),
        maxExclusive: z.number(),
        variableName: z.string(),
    }),
    z.object({
        name: z.literal("randomDate"),
        minYear: z.number(),
        maxYearExclusive: z.number(),
    }),
    z.object({
        name: z.literal("randomFromSelection"),
        values: z.array(z.string()),
        variableName: z.string(),
    }),
]);

const InducedWebsite = z.object({
    displayName: z.string(),
    summary: z.string().describe("One line describing what a generated URL points to"),
    tags: z.array(z.string()),
    schema: z
        .array(InducedUrlPart)
        .describe("Alternating fixed strings and variables; the first part is a fixed string starting with http"),
    variables: z.array(InducedVariable),
});

const InductionReply = z.object({
    classification: z.enum(["generatable", "hybrid", "opaque"]),
    reasoning: z.string(),
    leafWebsite: InducedWebsite.nullable().describe(
        "Only for 'generatable': scheme producing the result URLs themselves",
    ),
    indexWebsite: InducedWebsite.nullable().describe(
        "Only for 'hybrid': scheme producing index/archive pages that list result URLs",
    ),
    leafUrlRegex: z
        .string()
        .nullable()
        .describe("Only for 'hybrid': JS regex matching result URLs linked on the index pages"),
});

type InducedWebsiteT = z.infer<typeof InducedWebsite>;

const toWebsite = (induced: InducedWebsiteT): Website => ({
    version: 1,
    displayName: induced.displayName,
    summary: induced.summary,
    tags: induced.tags,
    schema: induced.schema,
    variables: induced.variables,
    downloadType: "downloadFromGeneratedURL",
});

const INDUCTION_PROMPT = `You infer URL generation schemes from sample URLs collected by a crawler.

Classify the site:
- "generatable": the RESULT urls themselves follow a scheme with predictable variables (dates, numeric ids in a dense range, known category names). Provide leafWebsite.
- "hybrid": the result urls contain unpredictable parts (title slugs, sparse ids), but the INDEX/ARCHIVE pages they were found on follow a scheme (e.g. /archiv/{year}/{month}/). Provide indexWebsite generating those index pages, plus leafUrlRegex matching result urls.
- "opaque": no usable scheme in either. Set the other fields null.

Rules for schemes:
- The "schema" array alternates fixed strings and variables, starting with a fixed string that begins with http.
- Use a randomDate variable when year/month/day appear; it fills variables named exactly "year", "month", "day". Reference them in the schema with padding 2 for zero-padded month/day.
- Use randomFromRange for numeric variables (choose min/maxExclusive from the observed value range). Name variables "year"/"month"/"day" only when they really are dates.
- Use randomFromSelection for small enumerable sets observed in the samples.
- Estimate date coverage (minYear/maxYearExclusive) from the samples; do not extrapolate far beyond what is observed.
- leafUrlRegex must be a valid JavaScript regex source (no delimiters) matching complete result URLs.`;

const sampleArray = <T>(values: T[], count: number): T[] => {
    if (values.length <= count) {
        return [...values];
    }
    const head = values.slice(0, Math.ceil(count / 4));
    const tail = values.slice(-Math.ceil(count / 4));
    const middle = [...values.slice(head.length, values.length - tail.length)];
    const randomMiddle: T[] = [];
    for (let i = 0; i < count - head.length - tail.length && middle.length > 0; i++) {
        randomMiddle.push(...middle.splice(Math.floor(Math.random() * middle.length), 1));
    }
    return [...head, ...randomMiddle, ...tail];
};

const resolveApiKey = async (): Promise<string> => {
    if (process.env.OPENAI_API_KEY) {
        return process.env.OPENAI_API_KEY;
    }
    const config = await import("../config.js");
    return config.default;
};

const probeUrl = async (url: string, scheduler: DomainScheduler): Promise<boolean> => {
    await scheduler.acquire(url);
    try {
        let response = await fetch(url, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(20_000),
        });
        if (response.status === 405 || response.status === 501) {
            response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
        }
        scheduler.reportResult(url, response.status);
        return response.status < 400;
    } catch {
        scheduler.reportResult(url, null);
        return false;
    }
};

/** Probe generated leaf URLs; hitRate = share that resolved. */
export const verifyLeafWebsite = async (
    website: Website,
    scheduler: DomainScheduler,
    samples = 10,
): Promise<{ hitRate: number; checked: number }> => {
    const urls = Array.from(new Set(generateUrlBatch(website, samples * 2).map((g) => g.url))).slice(0, samples);
    if (urls.length === 0) {
        return { hitRate: 0, checked: 0 };
    }
    let hits = 0;
    for (const url of urls) {
        if (await probeUrl(url, scheduler)) {
            hits++;
        }
    }
    return { hitRate: hits / urls.length, checked: urls.length };
};

/**
 * Probe generated index pages; hitRate = share of pages that resolve AND link
 * at least one URL matching leafUrlRegex. Matching links are harvested into
 * the site's URL pool as a side effect.
 */
export const verifyIndexWebsite = async (
    site: string,
    indexWebsite: Website,
    leafUrlRegex: string,
    scheduler: DomainScheduler,
    store: CrawlStore,
    samples = 6,
): Promise<{ hitRate: number; checked: number; harvested: number }> => {
    const leafRe = new RegExp(leafUrlRegex);
    const urls = Array.from(new Set(generateUrlBatch(indexWebsite, samples * 2).map((g) => g.url))).slice(0, samples);
    let hits = 0;
    let harvested = 0;
    for (const url of urls) {
        await scheduler.acquire(url);
        try {
            const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
            scheduler.reportResult(url, response.status);
            if (response.status >= 400) {
                continue;
            }
            const links = extractLinks(await response.text(), response.url || url);
            const matching = links.filter((link) => leafRe.test(link));
            if (matching.length > 0) {
                hits++;
                store.addDiscoveredLinks(site, { frontier: [], returned: matching });
                harvested += matching.length;
            }
        } catch {
            scheduler.reportResult(url, null);
        }
    }
    return { hitRate: urls.length === 0 ? 0 : hits / urls.length, checked: urls.length, harvested };
};

const recordFromParsed = (
    site: string,
    parsed: z.infer<typeof InductionReply>,
): InducedSchemaRecord => ({
    site,
    kind: parsed.classification as InducedSiteKind,
    website: parsed.leafWebsite ? toWebsite(parsed.leafWebsite) : null,
    indexWebsite: parsed.indexWebsite ? toWebsite(parsed.indexWebsite) : null,
    leafUrlRegex: parsed.leafUrlRegex,
    hitRate: null,
    verifiedSamples: 0,
    reasoning: parsed.reasoning,
    verifiedAt: Date.now(),
});

/** Write all induced schemas as a static snapshot for the web build. */
export const exportInducedSchemasSnapshot = (store: CrawlStore): string => {
    const records = store
        .listSchemas()
        .map((row) => row.definition as InducedSchemaRecord)
        .filter((record) => record && typeof record.site === "string");
    fs.mkdirSync(EXTRACTED_URLS_DIR, { recursive: true });
    const outputPath = path.join(EXTRACTED_URLS_DIR, "induced-schemas.json");
    fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));
    return outputPath;
};

export const listInducedSchemas = async (): Promise<InducedSchemaRecord[]> => {
    const store = await getCrawlStore();
    return store
        .listSchemas()
        .map((row) => row.definition as InducedSchemaRecord)
        .filter((record) => record && typeof record.site === "string");
};

export type InduceOptions = {
    model?: string;
    /** Test hook: bypasses OpenAI and uses this reply. */
    replyOverride?: z.infer<typeof InductionReply>;
    /** Skip network verification (still saves the schema, hitRate stays null). */
    skipVerification?: boolean;
    scheduler?: DomainScheduler;
};

/**
 * Induce a generation scheme for a crawled site from its collected URLs,
 * verify it against the live site, and persist it in the schemas table.
 */
export const induceSchemaForSite = async (
    site: string,
    options: InduceOptions = {},
): Promise<InducedSchemaRecord> => {
    const store = await getCrawlStore();
    const pool = store.getPool(site);
    if (pool.length < 10) {
        throw new Error(`Site "${site}" has only ${pool.length} collected URLs; crawl it first.`);
    }
    const leafSamples = sampleArray(pool.sort(), 120);
    const indexSamples = store.getVisitedFrontierSample(site, 30);

    let parsed: z.infer<typeof InductionReply>;
    if (options.replyOverride) {
        parsed = options.replyOverride;
    } else {
        const openai = new OpenAI({ apiKey: await resolveApiKey() });
        const response = await openai.chat.completions.parse({
            model: options.model ?? "gpt-4o",
            messages: [
                { role: "system", content: INDUCTION_PROMPT },
                {
                    role: "user",
                    content:
                        `Site name: ${site}\n\n` +
                        `Result URLs the crawler collected (sample of ${pool.length}):\n${leafSamples.join("\n")}\n\n` +
                        `Pages the crawler visited to find them (index/archive candidates):\n${indexSamples.join("\n")}`,
                },
            ],
            response_format: zodResponseFormat(InductionReply, "induction"),
        });
        const message = response.choices[0]?.message;
        if (!message?.parsed) {
            throw new Error("AI returned no parseable induction reply: " + (message?.refusal ?? "empty"));
        }
        parsed = message.parsed;
    }

    if (parsed.leafUrlRegex) {
        try {
            new RegExp(parsed.leafUrlRegex);
        } catch {
            throw new Error(`AI proposed an invalid leafUrlRegex: ${parsed.leafUrlRegex}`);
        }
    }

    const record = recordFromParsed(site, parsed);
    const scheduler = options.scheduler ?? new DomainScheduler(store);

    if (!options.skipVerification) {
        if (record.kind === "generatable" && record.website) {
            const { hitRate, checked } = await verifyLeafWebsite(record.website, scheduler);
            record.hitRate = hitRate;
            record.verifiedSamples = checked;
        } else if (record.kind === "hybrid" && record.indexWebsite && record.leafUrlRegex) {
            const { hitRate, checked, harvested } = await verifyIndexWebsite(
                site,
                record.indexWebsite,
                record.leafUrlRegex,
                scheduler,
                store,
            );
            record.hitRate = hitRate;
            record.verifiedSamples = checked;
            console.log(`Verification harvested ${harvested} URLs for ${site}`);
        }
    }

    store.saveSchema(site, record, record.hitRate);
    exportInducedSchemasSnapshot(store);
    store.exportSnapshot(site);
    return record;
};
