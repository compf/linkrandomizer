import { post } from "./ai-agent.js";
import {
    extractDateFromVariables,
    formatDateLabel,
} from "../models/date-period.js";
import { localeFromTags, siteKindFromTags } from "../models/url-period.js";
import type { GeneratedURL } from "../models/generated_url.js";

const STORAGE_KEY = "linkrandomizer.periodBriefings";
const memoryCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

const languageForLocale = (locale: string): string => {
    if (locale === "german") {
        return "German";
    }
    if (locale === "french") {
        return "French";
    }
    return "English";
};

export const periodBriefingCacheKey = (
    locale: string,
    year: number,
    month?: number,
): string => `${locale}|${year}|${month ?? "any"}`;

const readSessionCache = (): Record<string, string> => {
    if (typeof sessionStorage === "undefined") {
        return {};
    }
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) as Record<string, string> : {};
    } catch {
        return {};
    }
};

const writeSessionCache = (key: string, value: string): void => {
    if (typeof sessionStorage === "undefined") {
        return;
    }
    try {
        const cached = readSessionCache();
        cached[key] = value;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch {
        // Ignore quota / private-mode failures.
    }
};

const lookupCache = (key: string): string | undefined => {
    const memory = memoryCache.get(key);
    if (memory) {
        return memory;
    }
    const stored = readSessionCache()[key];
    if (stored) {
        memoryCache.set(key, stored);
        return stored;
    }
    return undefined;
};

const storeCache = (key: string, value: string): void => {
    memoryCache.set(key, value);
    writeSessionCache(key, value);
};

export type PeriodBriefingRequest = {
    year: number;
    month?: number;
    locale: string;
};

export const getPeriodBriefing = async (
    request: PeriodBriefingRequest,
): Promise<string> => {
    const key = periodBriefingCacheKey(request.locale, request.year, request.month);
    const cached = lookupCache(key);
    if (cached) {
        return cached;
    }

    const existing = inflight.get(key);
    if (existing) {
        return existing;
    }

    const language = languageForLocale(request.locale);
    const when = request.month
        ? `${request.month.toString().padStart(2, "0")}/${request.year}`
        : String(request.year);

    const pending = post(
        [
            {
                role: "system",
                content: `You briefly list historically important events for archive browsing. Reply in ${language}. Use a short bullet list (5-8 items). No preamble.`,
            },
            {
                role: "user",
                content: `What important events in ${when} would likely appear in newspapers, gazettes, parliamentary records, or similar archive pages from that time? Focus on events a reader of those sources would recognize.`,
            },
        ],
        { model: "gpt-4o-mini", maxCompletionTokens: 700 },
    ).then((text) => {
        storeCache(key, text);
        inflight.delete(key);
        return text;
    }).catch((error) => {
        inflight.delete(key);
        throw error;
    });

    inflight.set(key, pending);
    return pending;
};

export const briefingRequestForUrl = (
    generated: GeneratedURL,
): PeriodBriefingRequest | undefined => {
    const date = extractDateFromVariables(generated.variables, generated.url);
    if (date.year === undefined) {
        return undefined;
    }
    return {
        year: date.year,
        month: date.month,
        locale: localeFromTags(generated.website.tags),
    };
};

export const describeGeneratedUrl = (generated: GeneratedURL): string => {
    const date = extractDateFromVariables(generated.variables, generated.url);
    const dateLabel = formatDateLabel(date);
    const variables = Object.entries(generated.variables)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(", ");
    const kind = siteKindFromTags(generated.website.tags);
    const name = generated.website.displayName || kind;
    return [
        `Website: ${name}`,
        `Kind: ${kind}`,
        `URL: ${generated.url}`,
        dateLabel ? `Date: ${dateLabel}` : undefined,
        variables ? `Variables: ${variables}` : undefined,
        generated.website.summary ? `About this site: ${generated.website.summary}` : undefined,
        generated.website.tags.length ? `Tags: ${generated.website.tags.join(", ")}` : undefined,
    ].filter(Boolean).join("\n");
};
