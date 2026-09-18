import { GeneratedURL } from "../models/generated_url.js";
import { Website } from "../models/website_schemas.js";
import { GroupedURl } from "../models/url-grouper.js";
import { ItemRanker } from "./item-ranker.js";
import { extractDateFromVariables } from "../models/date-period.js";

export const extractDateFromUrl = (generatedUrl: GeneratedURL) => {
    return extractDateFromVariables(generatedUrl.variables, generatedUrl.url);
};

export const dateProximityScore = (
    generatedUrl: GeneratedURL,
    targetYear: number,
    targetMonth?: number
): number => {
    const extracted = extractDateFromUrl(generatedUrl);
    if (extracted.year === undefined) {
        return 0;
    }

    const yearDiff = Math.abs(extracted.year - targetYear);
    const monthDiff =
        targetMonth !== undefined && extracted.month !== undefined
            ? Math.abs(extracted.month - targetMonth)
            : targetMonth !== undefined
              ? 6
              : 0;

    return 10_000 - (yearDiff * 12 + monthDiff);
};

export const hashString = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
    }
    return hash;
};

export const dailySeed = (websiteName: string, date = new Date()): number => {
    const dayMonthSeed = date.getDate() * 100 + (date.getMonth() + 1);
    return hashString(`${websiteName}:${dayMonthSeed}`);
};

export const seededUnitRandom = (seed: number): number => {
    let state = seed >>> 0;
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
};

export const tagPriorityScore = (tags: string[], tagPriority: string[]): number => {
    let score = 0;
    for (let i = 0; i < tagPriority.length; i++) {
        if (tags.includes(tagPriority[i])) {
            score += (tagPriority.length - i) * 100;
        }
    }
    return score;
};

export const pickWebsiteByRank = (websites: Website[], ranker: ItemRanker): Website => {
    if (!ranker.rankWebsite || websites.length === 0) {
        return websites[Math.floor(Math.random() * websites.length)];
    }

    const scored = websites.map((website) => ({
        website,
        score: Math.max(0, ranker.rankWebsite!(website)),
    }));
    const total = scored.reduce((sum, entry) => sum + entry.score, 0);

    if (total <= 0) {
        return websites[Math.floor(Math.random() * websites.length)];
    }

    let remaining = Math.random() * total;
    for (const entry of scored) {
        remaining -= entry.score;
        if (remaining <= 0) {
            return entry.website;
        }
    }

    return scored[scored.length - 1].website;
};

export const sortUrls = (urls: GeneratedURL[], ranker: ItemRanker): GeneratedURL[] => {
    if (!ranker.rankUrl) {
        return urls;
    }

    return [...urls].sort((left, right) => ranker.rankUrl!(right) - ranker.rankUrl!(left));
};

export const sortGroupedUrls = (grouped: GroupedURl, ranker: ItemRanker): GroupedURl => {
    const sortedChildren = grouped.children?.map((child) => sortGroupedUrls(child, ranker)) ?? null;
    const sortedUrls = ranker.rankUrl ? sortUrls(grouped.urls, ranker) : grouped.urls;

    if (sortedChildren) {
        sortedChildren.sort((left, right) => {
            const leftScore = getGroupRankScore(left, ranker);
            const rightScore = getGroupRankScore(right, ranker);
            return rightScore - leftScore;
        });
    }

    return {
        ...grouped,
        children: sortedChildren,
        urls: sortedUrls,
    };
};

const getGroupRankScore = (group: GroupedURl, ranker: ItemRanker): number => {
    if (group.urls.length === 0) {
        return 0;
    }

    if (ranker.rankUrl) {
        return ranker.rankUrl(group.urls[0]);
    }

    if (ranker.rankWebsite) {
        return ranker.rankWebsite(group.urls[0].website);
    }

    return 0;
};

export const executeRankScript = (
    script: string
): {
    rankUrl?: (url: GeneratedURL) => number;
    rankWebsite?: (website: Website) => number;
} => {
    try {
        const runner = new Function(
            `"use strict";\n${script}\nreturn {\n  rankUrl: typeof rankUrl === \"function\" ? rankUrl : undefined,\n  rankWebsite: typeof rankWebsite === \"function\" ? rankWebsite : undefined\n};`
        ) as () => {
            rankUrl?: (url: GeneratedURL) => number;
            rankWebsite?: (website: Website) => number;
        };
        return runner();
    } catch (error) {
        console.error("Failed to execute rank script:", error);
        return {};
    }
};

export const sanitizeRankScore = (score: unknown): number => {
    return typeof score === "number" && Number.isFinite(score) ? score : 0;
};
