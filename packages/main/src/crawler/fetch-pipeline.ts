import type { DomainScheduler } from "./domain-scheduler.js";

export type FetchOutcome = {
    url: string;
    status: number | null;
    html: string | null;
    /** Absolute hrefs found on the page. */
    links: string[];
    /** True when the page looks like a bot-protection interstitial. */
    challenge: boolean;
    /** True when the page looks like a JS-only shell that needs a real browser. */
    needsBrowser: boolean;
    error?: string;
};

const CHALLENGE_MARKERS = [
    "just a moment",
    "cf-chl",
    "cf-turnstile",
    "challenge-platform",
    "attention required",
    "are you a robot",
    "unusual traffic",
    "access denied",
    "captcha",
];

export const looksLikeChallenge = (status: number | null, html: string | null): boolean => {
    if (status === 403 || status === 429 || status === 503) {
        return true;
    }
    if (!html) {
        return false;
    }
    const head = html.slice(0, 6000).toLowerCase();
    return CHALLENGE_MARKERS.some((marker) => head.includes(marker));
};

const HREF_RE = /<a\s[^>]*?href\s*=\s*("([^"]*)"|'([^']*)')/gi;

/** Extract absolute link targets from raw HTML, resolved against the page URL. */
export const extractLinks = (html: string, baseUrl: string): string[] => {
    const links: string[] = [];
    const seen = new Set<string>();
    for (const match of html.matchAll(HREF_RE)) {
        const raw = (match[2] ?? match[3] ?? "").trim();
        if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:")) {
            continue;
        }
        try {
            const resolved = new URL(raw, baseUrl).toString();
            if (!seen.has(resolved) && /^https?:/.test(resolved)) {
                seen.add(resolved);
                links.push(resolved);
            }
        } catch {
            // Malformed href; skip.
        }
    }
    return links;
};

/**
 * A page that returns 200 but nearly no links and lots of script tags is most
 * likely a client-rendered shell; those go to the browser tier.
 */
const looksLikeJsShell = (html: string, linkCount: number): boolean => {
    if (linkCount >= 5) {
        return false;
    }
    const scriptCount = (html.match(/<script/gi) ?? []).length;
    return scriptCount >= 3 && html.length < 200_000;
};

export type HttpFetcher = (url: string) => Promise<{ status: number; html: string | null; finalUrl: string }>;

export const defaultHttpFetcher: HttpFetcher = async (url) => {
    const response = await fetch(url, {
        redirect: "follow",
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en;q=0.9,de;q=0.8",
        },
        signal: AbortSignal.timeout(30_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const isText = contentType.includes("html") || contentType.includes("xml") || contentType.includes("text");
    const html = isText ? await response.text() : null;
    return { status: response.status, html, finalUrl: response.url || url };
};

/**
 * Tier-1 fetch: plain HTTP request plus regex link extraction. Callers fall
 * back to the browser tier when `challenge` or `needsBrowser` is set.
 */
export const fetchViaHttp = async (
    url: string,
    scheduler: DomainScheduler,
    fetcher: HttpFetcher = defaultHttpFetcher,
): Promise<FetchOutcome> => {
    await scheduler.acquire(url);
    try {
        const { status, html, finalUrl } = await fetcher(url);
        const challenge = looksLikeChallenge(status, html);
        scheduler.reportResult(url, status, challenge);
        const links = html && !challenge ? extractLinks(html, finalUrl) : [];
        return {
            url,
            status,
            html,
            links,
            challenge,
            needsBrowser: !challenge && html !== null && looksLikeJsShell(html, links.length),
        };
    } catch (error) {
        scheduler.reportResult(url, null, false);
        return {
            url,
            status: null,
            html: null,
            links: [],
            challenge: false,
            needsBrowser: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
};
