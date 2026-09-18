import {
    DatePeriod,
    extractDateFromString,
    isYearVariableName,
    periodIsEmpty,
} from "./date-period.js";
import type { Website } from "./website_schemas.js";

export type WebsiteCoverage = {
    hasDate: boolean;
    minYear?: number;
    maxYear?: number;
};

const mergeYear = (
    current: number | undefined,
    next: number,
    mode: "min" | "max",
): number => {
    if (current === undefined) {
        return next;
    }
    return mode === "min" ? Math.min(current, next) : Math.max(current, next);
};

const coverageFromUrlPool = (values: string[]): WebsiteCoverage => {
    let minYear: number | undefined;
    let maxYear: number | undefined;
    let dated = 0;
    const sample = values.length > 400 ? values.slice(0, 400) : values;
    for (const value of sample) {
        const date = extractDateFromString(value);
        if (date.year === undefined) {
            continue;
        }
        dated += 1;
        minYear = mergeYear(minYear, date.year, "min");
        maxYear = mergeYear(maxYear, date.year, "max");
    }
    if (dated === 0) {
        return { hasDate: false };
    }
    return { hasDate: true, minYear, maxYear };
};

export const websiteCoverage = (website: Website): WebsiteCoverage => {
    let hasDate = false;
    let minYear: number | undefined;
    let maxYear: number | undefined;

    for (const variable of website.variables) {
        if (variable.name === "randomDate" || variable.name === "randomDateRange") {
            hasDate = true;
            minYear = mergeYear(minYear, variable.minYear, "min");
            maxYear = mergeYear(maxYear, variable.maxYearExclusive - 1, "max");
            continue;
        }
        if (variable.name === "randomFromRange" && isYearVariableName(variable.variableName)) {
            hasDate = true;
            minYear = mergeYear(minYear, variable.min, "min");
            maxYear = mergeYear(maxYear, variable.maxExclusive - 1, "max");
            continue;
        }
        if (variable.name === "randomFromSelection" && variable.values.length > 0) {
            const fromUrls = coverageFromUrlPool(variable.values);
            if (fromUrls.hasDate) {
                hasDate = true;
                if (fromUrls.minYear !== undefined) {
                    minYear = mergeYear(minYear, fromUrls.minYear, "min");
                }
                if (fromUrls.maxYear !== undefined) {
                    maxYear = mergeYear(maxYear, fromUrls.maxYear, "max");
                }
            }
        }
    }

    if (website.obtainMoreVariablesFunction) {
        hasDate = true;
    }

    return { hasDate, minYear, maxYear };
};

export const websiteSupportsPeriod = (website: Website, period?: DatePeriod): boolean => {
    if (periodIsEmpty(period)) {
        return true;
    }
    const coverage = websiteCoverage(website);
    if (!coverage.hasDate) {
        return false;
    }
    if (period?.year !== undefined) {
        if (coverage.minYear !== undefined && period.year < coverage.minYear) {
            return false;
        }
        if (coverage.maxYear !== undefined && period.year > coverage.maxYear) {
            return false;
        }
    }
    return true;
};

export const formatCoverageLabel = (coverage: WebsiteCoverage): string => {
    if (!coverage.hasDate) {
        return "No date in URL";
    }
    if (coverage.minYear !== undefined && coverage.maxYear !== undefined) {
        return `${coverage.minYear}–${coverage.maxYear}`;
    }
    return "Dated";
};

export const localeFromTags = (tags: string[]): "german" | "english" | "french" => {
    if (tags.includes("german")) {
        return "german";
    }
    if (tags.includes("french")) {
        return "french";
    }
    return "english";
};

export const siteKindFromTags = (tags: string[]): string => {
    if (tags.includes("newspaper")) {
        return "newspaper archive";
    }
    if (tags.includes("parliamentary")) {
        return "parliamentary record";
    }
    if (tags.includes("legal")) {
        return "legal document";
    }
    if (tags.includes("wikipedia")) {
        return "encyclopedia article";
    }
    if (tags.includes("government")) {
        return "government publication";
    }
    return "historical page";
};
