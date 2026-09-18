import {
    extractDateFromVariables,
    formatDateLabel,
    isDayVariableName,
    isMonthVariableName,
    isYearVariableName,
} from "./date-period.js";
import type { GeneratedURL } from "./generated_url.js";
import { formatCoverageLabel, websiteCoverage } from "./url-period.js";

export type FormattedGeneratedUrl = {
    title: string;
    dateLabel?: string;
    extras: { key: string; value: string }[];
    displayUrl: string;
    websiteName: string;
    summary?: string;
    undated: boolean;
    coverageLabel: string;
    tags: string[];
};

const formatVariableValue = (value: unknown): string => {
    if (value == null) {
        return "";
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
};

export const websiteDisplayName = (websiteName: string, website: { displayName?: string | null }): string => {
    return website.displayName?.trim() || websiteName;
};

export const formatGeneratedUrl = (
    generated: GeneratedURL,
    websiteName: string,
): FormattedGeneratedUrl => {
    const date = extractDateFromVariables(generated.variables, generated.url);
    const dateLabel = formatDateLabel(date);
    const extras = Object.entries(generated.variables)
        .filter(([key]) => !isYearVariableName(key) && !isMonthVariableName(key) && !isDayVariableName(key))
        .map(([key, value]) => ({ key, value: formatVariableValue(value) }))
        .filter((entry) => entry.value !== "" && entry.value !== generated.url);

    const name = websiteDisplayName(websiteName, generated.website);
    const undated = date.year === undefined;

    return {
        title: dateLabel ?? (extras[0] ? `${name} · ${extras[0].key} ${extras[0].value}` : name),
        dateLabel,
        extras,
        displayUrl: generated.url,
        websiteName: name,
        summary: generated.website.summary ?? undefined,
        undated,
        coverageLabel: formatCoverageLabel(websiteCoverage(generated.website)),
        tags: generated.website.tags,
    };
};
