/** Serializable simple website controller driven by regular expressions. */
export type RegexWebsiteControllerDefinition = {
    name: string;
    initialUrl: string;
    parentDomain: string;
    maxDepth: number;
    /** URLs matching this pattern may be crawled further. */
    canBeVisitedRegex: string;
    /** URLs matching this pattern are kept as results. */
    canBeReturnedRegex: string;
    /**
     * If non-empty, crawling pauses while this pattern matches the page body text
     * (e.g. cookie-banner copy). Empty string disables the check.
     */
    requireUserAttentionRegex: string;
};

export const isRegexWebsiteControllerDefinition = (
    value: unknown,
): value is RegexWebsiteControllerDefinition => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const v = value as Record<string, unknown>;
    return (
        typeof v.name === "string" &&
        typeof v.initialUrl === "string" &&
        typeof v.parentDomain === "string" &&
        typeof v.maxDepth === "number" &&
        typeof v.canBeVisitedRegex === "string" &&
        typeof v.canBeReturnedRegex === "string" &&
        typeof v.requireUserAttentionRegex === "string"
    );
};
