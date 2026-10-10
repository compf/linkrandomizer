import type { CrawlStore } from "../storage/crawl-store.js";

export type SchedulerOptions = {
    /** Minimum pause between two requests to the same domain. */
    minDelayMs?: number;
    /** Random extra delay added on top of the minimum. */
    jitterMs?: number;
    /** Base cooldown after a block signal; doubles per consecutive block. */
    blockCooldownMs?: number;
    maxCooldownMs?: number;
};

const DEFAULTS: Required<SchedulerOptions> = {
    minDelayMs: 1500,
    jitterMs: 1200,
    blockCooldownMs: 30_000,
    maxCooldownMs: 15 * 60_000,
};

type DomainState = {
    nextAllowedAt: number;
    consecutiveBlocks: number;
    blockedUntil: number;
};

export const domainOf = (url: string): string => {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
};

/** Blocking-ish HTTP statuses that mean "slow down or go away". */
export const isBlockStatus = (status: number | null | undefined): boolean =>
    status === 403 || status === 429 || status === 503;

/**
 * Per-domain politeness: enforces a minimum delay with jitter between requests
 * to the same host and backs off exponentially when a host signals blocking.
 */
export class DomainScheduler {
    private domains = new Map<string, DomainState>();
    private options: Required<SchedulerOptions>;
    private store: CrawlStore | undefined;

    constructor(store?: CrawlStore, options: SchedulerOptions = {}) {
        this.store = store;
        this.options = { ...DEFAULTS, ...options };
    }

    private stateFor(domain: string): DomainState {
        let state = this.domains.get(domain);
        if (!state) {
            state = { nextAllowedAt: 0, consecutiveBlocks: 0, blockedUntil: 0 };
            this.domains.set(domain, state);
        }
        return state;
    }

    /** Milliseconds until the domain may be contacted again; 0 when free. */
    waitTimeFor(url: string): number {
        const state = this.stateFor(domainOf(url));
        return Math.max(0, Math.max(state.nextAllowedAt, state.blockedUntil) - Date.now());
    }

    /** True while the domain is in a block cooldown (crawler should move on). */
    isBlocked(url: string): boolean {
        return this.stateFor(domainOf(url)).blockedUntil > Date.now();
    }

    /**
     * Wait for the domain's slot, then claim it. The browser tier passes
     * `ignoreBlock` because it is the sanctioned way through a challenge — it
     * must not be held back by the cooldown that the challenge itself caused.
     */
    async acquire(url: string, { ignoreBlock = false }: { ignoreBlock?: boolean } = {}): Promise<void> {
        const domain = domainOf(url);
        for (;;) {
            const state = this.stateFor(domain);
            const until = ignoreBlock ? state.nextAllowedAt : Math.max(state.nextAllowedAt, state.blockedUntil);
            const wait = Math.max(0, until - Date.now());
            if (wait <= 0) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 2_000)));
        }
        const state = this.stateFor(domain);
        state.nextAllowedAt =
            Date.now() + this.options.minDelayMs + Math.random() * this.options.jitterMs;
    }

    /** Record a response; block statuses trigger exponential per-domain cooldown. */
    reportResult(url: string, status: number | null, challenge = false): void {
        const domain = domainOf(url);
        const state = this.stateFor(domain);
        this.store?.logFetch(domain, status);
        if (isBlockStatus(status) || challenge) {
            state.consecutiveBlocks += 1;
            const cooldown = Math.min(
                this.options.blockCooldownMs * 2 ** (state.consecutiveBlocks - 1),
                this.options.maxCooldownMs,
            );
            state.blockedUntil = Date.now() + cooldown;
            console.warn(
                `Domain ${domain} signalled blocking (status ${status}, challenge ${challenge}); cooling down ${Math.round(cooldown / 1000)}s`,
            );
        } else if (status !== null && status < 400) {
            state.consecutiveBlocks = 0;
            state.blockedUntil = 0;
        }
    }
}
