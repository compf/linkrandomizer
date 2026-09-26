import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type {
    ControllerAssistRequest,
    ControllerAssistResult,
    RegexWebsiteControllerDefinition,
} from "@linkrandomizer/common";
import { DomainScheduler } from "../crawler/domain-scheduler.js";
import { fetchViaHttp } from "../crawler/fetch-pipeline.js";

const ProposalReply = z.object({
    reasoning: z.string().describe("Short explanation of the proposal, aimed at the user"),
    controller: z.object({
        name: z.string().describe("Short identifier, letters/digits/underscores"),
        initialUrl: z.string(),
        parentDomain: z.string().describe("Scheme + host, used to resolve relative links"),
        maxDepth: z.number().describe("How many link levels to follow; keep small (1-4)"),
        canBeVisitedRegex: z
            .string()
            .describe("JS regex for pages the crawler should open to find more links (index/archive pages)"),
        canBeReturnedRegex: z.string().describe("JS regex for the result URLs to collect"),
        requireUserAttentionRegex: z
            .string()
            .describe("Regex matched against page text to pause for the user (cookie/captcha wording); empty to disable"),
        sitemapUrl: z.string().nullable().describe("Sitemap URL if one is known from the evidence, else null"),
        feedUrl: z.string().nullable().describe("RSS/Atom feed URL if one is known from the evidence, else null"),
    }),
});

const SYSTEM_PROMPT = `You help configure a polite website crawler. A controller has:
- canBeVisitedRegex: matches URLs of pages worth opening to DISCOVER more links (archive/index/listing pages). Keep it tight; matching everything floods the crawl.
- canBeReturnedRegex: matches the RESULT URLs the user wants to collect (articles, documents, ...). These are collected from links without being visited.
- maxDepth: link-following depth from the initial URL; prefer 1-3.
- parentDomain: scheme+host used to resolve relative links.
- requireUserAttentionRegex: matched against visible page text; when it matches, crawling pauses so the user can clear a banner or captcha. Usually empty.
- sitemapUrl / feedUrl: only from the provided evidence; null when none was found.

You get evidence: the initial page's title and a sample of links found on it, plus any discovered sitemaps/feeds. Base the regexes on the ACTUAL link shapes in the evidence, not on guesses. Escape regex metacharacters in literal URL parts (dots!). The regexes are tested with JavaScript RegExp.test against absolute URLs.

When the user corrects you, keep what was right and change what they objected to. Always return the complete controller.`;

type PageEvidence = {
    startUrl: string;
    title: string;
    links: string[];
    feeds: string[];
    sitemaps: string[];
    fetchNote: string;
};

const evidenceCache = new Map<string, PageEvidence>();
const assistScheduler = new DomainScheduler(undefined, { minDelayMs: 1000, jitterMs: 500 });

const FEED_LINK_RE =
    /<link\b[^>]*?type\s*=\s*["']application\/(?:rss|atom)\+xml["'][^>]*?href\s*=\s*["']([^"']+)["']|<link\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*?type\s*=\s*["']application\/(?:rss|atom)\+xml["']/gi;

const discoverFeeds = (html: string, baseUrl: string): string[] => {
    const feeds = new Set<string>();
    for (const match of html.matchAll(FEED_LINK_RE)) {
        const href = match[1] ?? match[2];
        if (href) {
            try {
                feeds.add(new URL(href, baseUrl).toString());
            } catch {
                // Malformed href.
            }
        }
    }
    return [...feeds];
};

const discoverSitemaps = async (origin: string): Promise<string[]> => {
    try {
        await assistScheduler.acquire(origin + "/robots.txt");
        const response = await fetch(origin + "/robots.txt", {
            redirect: "follow",
            signal: AbortSignal.timeout(15_000),
        });
        assistScheduler.reportResult(origin + "/robots.txt", response.status);
        if (!response.ok) {
            return [];
        }
        const text = await response.text();
        const sitemaps: string[] = [];
        for (const line of text.split(/\r?\n/)) {
            const match = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
            if (match?.[1]) {
                sitemaps.push(match[1]);
            }
        }
        return sitemaps.slice(0, 5);
    } catch {
        return [];
    }
};

/** Sample links while keeping shape diversity: group by path prefix, take a few of each. */
const sampleLinks = (links: string[], max = 120): string[] => {
    const groups = new Map<string, string[]>();
    for (const link of links) {
        try {
            const url = new URL(link);
            const segments = url.pathname.split("/");
            const key = url.hostname + "/" + (segments[1] ?? "") + "/" + (segments[2] ?? "");
            const group = groups.get(key) ?? [];
            if (group.length < 8) {
                group.push(link);
                groups.set(key, group);
            }
        } catch {
            // Skip malformed.
        }
    }
    const sampled: string[] = [];
    for (const group of groups.values()) {
        sampled.push(...group);
    }
    return sampled.slice(0, max);
};

const gatherEvidence = async (startUrl: string): Promise<PageEvidence> => {
    const cached = evidenceCache.get(startUrl);
    if (cached) {
        return cached;
    }
    const outcome = await fetchViaHttp(startUrl, assistScheduler);
    let fetchNote = "";
    if (outcome.error) {
        fetchNote = `Fetching the page failed: ${outcome.error}`;
    } else if (outcome.challenge) {
        fetchNote = "The page served a bot-protection/challenge response; link evidence may be incomplete.";
    } else if (outcome.needsBrowser) {
        fetchNote = "The page looks like a JavaScript-rendered shell; link evidence may be incomplete.";
    }
    const title = outcome.html?.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
    const origin = new URL(startUrl).origin;
    const evidence: PageEvidence = {
        startUrl,
        title,
        links: sampleLinks(outcome.links),
        feeds: outcome.html ? discoverFeeds(outcome.html, startUrl) : [],
        sitemaps: await discoverSitemaps(origin),
        fetchNote,
    };
    if (!outcome.error) {
        evidenceCache.set(startUrl, evidence);
    }
    return evidence;
};

const evidenceMessage = (evidence: PageEvidence): string =>
    `Initial URL: ${evidence.startUrl}\n` +
    `Page title: ${evidence.title || "(none)"}\n` +
    (evidence.fetchNote ? `Note: ${evidence.fetchNote}\n` : "") +
    `Discovered sitemaps: ${evidence.sitemaps.length ? evidence.sitemaps.join(", ") : "(none)"}\n` +
    `Discovered feeds: ${evidence.feeds.length ? evidence.feeds.join(", ") : "(none)"}\n` +
    `Sample of links on the page (${evidence.links.length}):\n${evidence.links.join("\n")}`;

const resolveApiKey = async (): Promise<string> => {
    if (process.env.OPENAI_API_KEY) {
        return process.env.OPENAI_API_KEY;
    }
    const config = await import("../config.js");
    return config.default;
};

const validateRegexes = (
    controller: z.infer<typeof ProposalReply>["controller"],
): string | null => {
    for (const [label, pattern] of [
        ["canBeVisitedRegex", controller.canBeVisitedRegex],
        ["canBeReturnedRegex", controller.canBeReturnedRegex],
        ["requireUserAttentionRegex", controller.requireUserAttentionRegex],
    ] as const) {
        if (!pattern && label !== "requireUserAttentionRegex") {
            return `${label} is empty`;
        }
        try {
            if (pattern) {
                new RegExp(pattern);
            }
        } catch {
            return `${label} is not a valid regex: ${pattern}`;
        }
    }
    return null;
};

export type ProposeControllerOptions = {
    model?: string;
    /** Test hook: bypasses OpenAI. */
    replyOverride?: z.infer<typeof ProposalReply>;
};

/**
 * Propose (or refine, when history is present) a crawler controller for a
 * start URL. Evidence is gathered from the live page once and cached; the
 * proposal's regexes are validated and matched against the evidence so the
 * user sees what they would actually select.
 */
export const proposeController = async (
    request: ControllerAssistRequest,
    options: ProposeControllerOptions = {},
): Promise<ControllerAssistResult> => {
    let evidence: PageEvidence;
    try {
        evidence = await gatherEvidence(request.startUrl.trim());
    } catch (error) {
        return { ok: false, error: `Could not examine ${request.startUrl}: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (evidence.links.length === 0) {
        return {
            ok: false,
            error:
                evidence.fetchNote ||
                "No links found on the page; the crawler could not learn anything from it.",
        };
    }

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: evidenceMessage(evidence) },
        ...request.history.map(
            (turn): ChatCompletionMessageParam => ({ role: turn.role, content: turn.content }),
        ),
        { role: "user", content: request.instruction || "Propose a controller for this site." },
    ];

    let parsed: z.infer<typeof ProposalReply>;
    if (options.replyOverride) {
        parsed = options.replyOverride;
    } else {
        const openai = new OpenAI({ apiKey: await resolveApiKey() });
        // One retry with the validation error fed back, then give up.
        for (let attempt = 0; ; attempt++) {
            const response = await openai.chat.completions.parse({
                model: options.model ?? "gpt-4o",
                messages,
                response_format: zodResponseFormat(ProposalReply, "controller_proposal"),
            });
            const message = response.choices[0]?.message;
            if (!message?.parsed) {
                return { ok: false, error: "AI returned no parseable proposal: " + (message?.refusal ?? "empty") };
            }
            const problem = validateRegexes(message.parsed.controller);
            if (!problem) {
                parsed = message.parsed;
                break;
            }
            if (attempt >= 1) {
                return { ok: false, error: `AI kept proposing an invalid controller (${problem}). Try rephrasing.` };
            }
            messages.push(
                { role: "assistant", content: JSON.stringify(message.parsed) },
                { role: "user", content: `That proposal is invalid: ${problem}. Fix it and return the full controller.` },
            );
        }
    }

    const problem = validateRegexes(parsed.controller);
    if (problem) {
        return { ok: false, error: `Invalid proposal: ${problem}` };
    }

    const proposal: RegexWebsiteControllerDefinition = {
        name: parsed.controller.name,
        initialUrl: parsed.controller.initialUrl || request.startUrl,
        parentDomain: parsed.controller.parentDomain,
        maxDepth: parsed.controller.maxDepth,
        canBeVisitedRegex: parsed.controller.canBeVisitedRegex,
        canBeReturnedRegex: parsed.controller.canBeReturnedRegex,
        requireUserAttentionRegex: parsed.controller.requireUserAttentionRegex,
        sitemapUrl: parsed.controller.sitemapUrl ?? "",
        feedUrl: parsed.controller.feedUrl ?? "",
    };

    const visitedRe = new RegExp(proposal.canBeVisitedRegex);
    const returnedRe = new RegExp(proposal.canBeReturnedRegex);
    return {
        ok: true,
        proposal,
        reasoning: parsed.reasoning,
        sampleVisited: evidence.links.filter((link) => visitedRe.test(link)).slice(0, 8),
        sampleReturned: evidence.links.filter((link) => returnedRe.test(link)).slice(0, 8),
        assistantMessage: JSON.stringify({ reasoning: parsed.reasoning, controller: proposal }),
    };
};
