import type { InducedSchemaRecord, Website } from "@linkrandomizer/common";
import type { WebsiteController } from "../../url-finder-type.js";
import { getCrawlStore, type CrawlStore } from "../storage/crawl-store.js";
import { runCrawl, type CrawlCallbacks } from "./crawl-loop.js";

const MAX_INDEX_PAGES = 2000;
const MAX_VALUES_PER_VARIABLE = 500;

type VariableValues = { name: string; values: (string | number)[] };

const rangeValues = (min: number, maxExclusive: number): number[] => {
    const values: number[] = [];
    for (let v = min; v < maxExclusive && values.length < MAX_VALUES_PER_VARIABLE; v++) {
        values.push(v);
    }
    return values;
};

const schemaUsesVariable = (website: Website, name: string): boolean =>
    website.schema.some((part) => typeof part !== "string" && part.variable === name);

/**
 * Expand an index scheme's variables into concrete value lists. Dates expand
 * to year/month (and day only when the schema actually uses one); years are
 * enumerated descending so the page cap keeps the most recent periods.
 */
const enumerateVariables = (website: Website): VariableValues[] => {
    const result: VariableValues[] = [];
    for (const variable of website.variables) {
        if (variable.name === "randomDate") {
            const years = rangeValues(variable.minYear, variable.maxYearExclusive).reverse();
            result.push({ name: "year", values: years });
            if (schemaUsesVariable(website, "month")) {
                result.push({ name: "month", values: rangeValues(1, 13) });
            }
            if (schemaUsesVariable(website, "day")) {
                result.push({ name: "day", values: rangeValues(1, 32) });
            }
        } else if (variable.name === "randomFromRange") {
            result.push({
                name: variable.variableName,
                values: rangeValues(variable.min, variable.maxExclusive),
            });
        } else if (variable.name === "randomFromSelection") {
            result.push({ name: variable.variableName, values: variable.values });
        }
    }
    return result;
};

const stitch = (website: Website, values: Record<string, string | number>): string => {
    let url = "";
    for (const part of website.schema) {
        if (typeof part === "string") {
            url += part;
        } else {
            const value = String(values[part.variable] ?? "");
            url += part.padding ? value.padStart(part.padding, "0") : value;
        }
    }
    return url;
};

const isInFuture = (values: Record<string, string | number>): boolean => {
    const now = new Date();
    const year = Number(values.year);
    if (!Number.isFinite(year)) {
        return false;
    }
    if (year > now.getFullYear()) {
        return true;
    }
    const month = Number(values.month);
    if (year === now.getFullYear() && Number.isFinite(month)) {
        return month > now.getMonth() + 1;
    }
    return false;
};

/** The current (still mutable) period should be re-fetched on every harvest. */
const isCurrentPeriod = (values: Record<string, string | number>): boolean => {
    const now = new Date();
    const year = Number(values.year);
    const month = Number(values.month);
    if (!Number.isFinite(year)) {
        return false;
    }
    if (!Number.isFinite(month)) {
        return year === now.getFullYear();
    }
    return year === now.getFullYear() && month === now.getMonth() + 1;
};

export type HarvestSeed = { url: string; reopen: boolean };

/** Enumerate the concrete index-page URLs an induced hybrid scheme covers. */
export const enumerateIndexPages = (indexWebsite: Website): HarvestSeed[] => {
    const dimensions = enumerateVariables(indexWebsite);
    const seeds: HarvestSeed[] = [];
    const walk = (index: number, values: Record<string, string | number>) => {
        if (seeds.length >= MAX_INDEX_PAGES) {
            return;
        }
        if (index === dimensions.length) {
            if (!isInFuture(values)) {
                seeds.push({ url: stitch(indexWebsite, values), reopen: isCurrentPeriod(values) });
            }
            return;
        }
        for (const value of dimensions[index]!.values) {
            values[dimensions[index]!.name] = value;
            walk(index + 1, values);
            if (seeds.length >= MAX_INDEX_PAGES) {
                return;
            }
        }
    };
    walk(0, {});
    return seeds;
};

/**
 * Seed the frontier with every enumerated index page. Immutable past periods
 * keep their visited state (insert-or-ignore); the current period is reopened
 * so a re-harvest picks up new links.
 */
export const seedHarvestFrontier = (store: CrawlStore, site: string, seeds: HarvestSeed[]): number => {
    let seeded = 0;
    for (const seed of seeds) {
        if (seed.reopen) {
            store.reopenFrontierUrl(site, seed.url, 0);
            seeded++;
        } else if (!store.hasFrontierUrl(site, seed.url)) {
            store.addFrontierUrl(site, seed.url, 0);
            seeded++;
        }
    }
    return seeded;
};

const harvestController = (record: InducedSchemaRecord, firstUrl: string): WebsiteController => {
    const leafRe = new RegExp(record.leafUrlRegex!);
    const firstPart = record.indexWebsite!.schema.find((p): p is string => typeof p === "string") ?? firstUrl;
    return {
        // No link-following: the scheme enumerates the index pages directly.
        canBeVisited: () => false,
        canBeReturned: (url: string) => leafRe.test(url),
        requireUserAttention: async () => false,
        maxDepth: () => 1,
        initialUrl: () => firstUrl,
        name: () => record.site,
        parentDomain: () => new URL(firstPart).origin,
    };
};

/**
 * Run a scheme-driven harvest for a hybrid site: enumerate its index pages
 * and collect matching leaf URLs, with all crawl-loop politeness applied.
 */
export const harvestSite = async (site: string, callbacks?: CrawlCallbacks): Promise<void> => {
    const store = await getCrawlStore();
    const row = store.listSchemas().find((s) => s.name === site);
    const record = row?.definition as InducedSchemaRecord | undefined;
    if (!record || record.kind !== "hybrid" || !record.indexWebsite || !record.leafUrlRegex) {
        throw new Error(`Site "${site}" has no hybrid schema to harvest from.`);
    }
    const seeds = enumerateIndexPages(record.indexWebsite);
    if (seeds.length === 0) {
        throw new Error(`The index scheme for "${site}" enumerates no pages.`);
    }
    const seeded = seedHarvestFrontier(store, site, seeds);
    console.log(`Harvest for ${site}: ${seeds.length} index pages enumerated, ${seeded} (re)opened.`);
    await runCrawl([harvestController(record, seeds[0]!.url)], { callbacks: callbacks ? { ...callbacks } : {} });
};
