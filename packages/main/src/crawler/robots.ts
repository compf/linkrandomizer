import type { DomainScheduler } from "./domain-scheduler.js";

type RobotsRule = { allow: boolean; pattern: string; regex: RegExp };

type RobotsEntry = { rules: RobotsRule[] };

/** Convert a robots.txt path pattern (supports * and $) into a regex. */
const patternToRegex = (pattern: string): RegExp => {
    const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\\\$$/, "$");
    return new RegExp("^" + escaped);
};

/** Parse the groups applying to User-agent: * (we send no custom agent). */
export const parseRobots = (text: string): RobotsEntry => {
    const rules: RobotsRule[] = [];
    let currentAgents: string[] = [];
    let groupApplies = false;
    let inGroupHeader = false;

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*$/, "").trim();
        if (!line) {
            continue;
        }
        const colon = line.indexOf(":");
        if (colon < 0) {
            continue;
        }
        const field = line.slice(0, colon).trim().toLowerCase();
        const value = line.slice(colon + 1).trim();

        if (field === "user-agent") {
            if (!inGroupHeader) {
                currentAgents = [];
                inGroupHeader = true;
            }
            currentAgents.push(value.toLowerCase());
            groupApplies = currentAgents.includes("*");
        } else if (field === "allow" || field === "disallow") {
            inGroupHeader = false;
            if (groupApplies && value) {
                rules.push({ allow: field === "allow", pattern: value, regex: patternToRegex(value) });
            }
        } else {
            inGroupHeader = false;
        }
    }
    return { rules };
};

/** Longest-match wins; Allow wins ties (Google semantics). Empty rules → allowed. */
export const robotsAllows = (entry: RobotsEntry, pathAndQuery: string): boolean => {
    let best: RobotsRule | undefined;
    for (const rule of entry.rules) {
        if (rule.regex.test(pathAndQuery)) {
            if (
                !best ||
                rule.pattern.length > best.pattern.length ||
                (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
            ) {
                best = rule;
            }
        }
    }
    return best ? best.allow : true;
};

/**
 * Per-origin robots.txt cache. Fetch failures and 4xx fall back to "allowed"
 * (the politeness scheduler still limits us); parse errors likewise.
 */
export class RobotsCache {
    private entries = new Map<string, Promise<RobotsEntry>>();
    private scheduler: DomainScheduler;

    constructor(scheduler: DomainScheduler) {
        this.scheduler = scheduler;
    }

    private fetchEntry(origin: string): Promise<RobotsEntry> {
        let entry = this.entries.get(origin);
        if (!entry) {
            entry = (async () => {
                try {
                    // A metadata probe: throttle it, but never let a failed or
                    // challenged robots.txt put the whole domain into cooldown.
                    await this.scheduler.acquire(origin + "/robots.txt", { ignoreBlock: true });
                    const response = await fetch(origin + "/robots.txt", {
                        redirect: "follow",
                        signal: AbortSignal.timeout(20_000),
                    });
                    if (!response.ok) {
                        return { rules: [] };
                    }
                    return parseRobots(await response.text());
                } catch {
                    return { rules: [] };
                }
            })();
            this.entries.set(origin, entry);
        }
        return entry;
    }

    async isAllowed(url: string): Promise<boolean> {
        try {
            const parsed = new URL(url);
            const entry = await this.fetchEntry(parsed.origin);
            return robotsAllows(entry, parsed.pathname + parsed.search);
        } catch {
            return true;
        }
    }
}
