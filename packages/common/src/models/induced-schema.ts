import { type Website } from "./website_schemas.js";

/**
 * How a site's URL space can be produced:
 * - "generatable": a pure scheme covers the leaf URLs; no crawling needed.
 * - "hybrid": index/archive pages follow a scheme, but leaf URLs (e.g. article
 *   slugs) are unguessable; the index scheme drives harvesting of a URL pool.
 * - "opaque": no usable structure was found; classic crawling remains.
 */
export type InducedSiteKind = "generatable" | "hybrid" | "opaque";

/** An AI-induced generation scheme for a crawled site, persisted in the crawl DB. */
export type InducedSchemaRecord = {
    site: string;
    kind: InducedSiteKind;
    /** Leaf-URL generator; set for "generatable" sites. */
    website: Website | null;
    /** Index-page generator that drives harvesting; set for "hybrid" sites. */
    indexWebsite: Website | null;
    /** Regex matching leaf URLs on generated index pages; set for "hybrid" sites. */
    leafUrlRegex: string | null;
    /** Share of sampled generated URLs that resolved (0..1); null when unverified. */
    hitRate: number | null;
    /** Number of URLs probed during verification. */
    verifiedSamples: number;
    reasoning: string;
    verifiedAt: number;
};

export type InduceSchemaResult =
    | { ok: true; record: InducedSchemaRecord }
    | { ok: false; error: string };

/**
 * Build a Website whose generator simply picks from a harvested URL pool —
 * how hybrid sites surface in the explorer.
 */
export const websiteFromUrlPool = (record: InducedSchemaRecord, pool: string[]): Website => {
    const template = record.indexWebsite ?? record.website;
    return {
        version: 1,
        displayName: template?.displayName ?? record.site,
        summary: template?.summary ?? `Random URL from the crawled pool of ${record.site}`,
        tags: template?.tags ?? [],
        schema: [{ variable: "url", padding: null }],
        variables: [{ name: "randomFromSelection", values: pool, variableName: "url" }],
        downloadType: "downloadFromGeneratedURL",
    };
};
