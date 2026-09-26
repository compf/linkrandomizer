import { gunzipSync } from "zlib";
import type { DomainScheduler } from "./domain-scheduler.js";

const LOC_RE = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
const RSS_LINK_RE = /<link>\s*([^<]+?)\s*<\/link>/gi;
const ATOM_LINK_RE = /<link\b[^>]*?href\s*=\s*["']([^"']+)["']/gi;

const decodeXmlEntities = (value: string): string =>
    value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

const fetchXml = async (url: string, scheduler: DomainScheduler): Promise<string | null> => {
    await scheduler.acquire(url);
    try {
        const response = await fetch(url, {
            redirect: "follow",
            headers: { Accept: "application/xml,text/xml,application/rss+xml,*/*;q=0.8" },
            signal: AbortSignal.timeout(45_000),
        });
        scheduler.reportResult(url, response.status);
        if (!response.ok) {
            return null;
        }
        if (url.endsWith(".gz") && !(response.headers.get("content-type") ?? "").includes("xml")) {
            const buffer = Buffer.from(await response.arrayBuffer());
            return gunzipSync(buffer).toString("utf8");
        }
        return await response.text();
    } catch (error) {
        scheduler.reportResult(url, null);
        console.error("Failed to fetch sitemap/feed", url, error);
        return null;
    }
};

const extractAll = (xml: string, re: RegExp): string[] => {
    const urls: string[] = [];
    for (const match of xml.matchAll(re)) {
        const value = decodeXmlEntities((match[1] ?? "").trim());
        if (/^https?:\/\//.test(value)) {
            urls.push(value);
        }
    }
    return urls;
};

export type SitemapResult = {
    urls: string[];
    sitemapsVisited: number;
    truncated: boolean;
};

/**
 * Collect page URLs from a sitemap (recursing into sitemap indexes). One
 * polite request per sitemap file; `maxUrls`/`maxSitemaps` bound the work.
 */
export const collectSitemapUrls = async (
    sitemapUrl: string,
    scheduler: DomainScheduler,
    { maxUrls = 50_000, maxSitemaps = 50 }: { maxUrls?: number; maxSitemaps?: number } = {},
): Promise<SitemapResult> => {
    const urls: string[] = [];
    const queue = [sitemapUrl];
    const visited = new Set<string>();
    let truncated = false;

    while (queue.length > 0 && urls.length < maxUrls && visited.size < maxSitemaps) {
        const current = queue.shift()!;
        if (visited.has(current)) {
            continue;
        }
        visited.add(current);
        const xml = await fetchXml(current, scheduler);
        if (!xml) {
            continue;
        }
        const locs = extractAll(xml, LOC_RE);
        const isIndex = /<sitemapindex/i.test(xml);
        for (const loc of locs) {
            if (isIndex || /\.xml(\.gz)?([?#].*)?$/i.test(loc)) {
                queue.push(loc);
            } else if (urls.length < maxUrls) {
                urls.push(loc);
            } else {
                truncated = true;
            }
        }
    }
    if (queue.length > 0) {
        truncated = true;
    }
    return { urls, sitemapsVisited: visited.size, truncated };
};

/** Collect item links from an RSS or Atom feed (single request). */
export const collectFeedUrls = async (
    feedUrl: string,
    scheduler: DomainScheduler,
): Promise<string[]> => {
    const xml = await fetchXml(feedUrl, scheduler);
    if (!xml) {
        return [];
    }
    const rss = extractAll(xml, RSS_LINK_RE);
    const atom = extractAll(xml, ATOM_LINK_RE);
    return Array.from(new Set([...rss, ...atom].filter((u) => u !== feedUrl)));
};
