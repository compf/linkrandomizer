import type { WebsiteController } from "../../url-finder-type.js";
import { getCrawlStore, type CrawlStore } from "../storage/crawl-store.js";
import { DomainScheduler } from "./domain-scheduler.js";
import { fetchViaHttp, extractLinks, looksLikeChallenge, type FetchOutcome, type HttpFetcher } from "./fetch-pipeline.js";
import { collectSitemapUrls, collectFeedUrls } from "./sitemap.js";
import { BrowserSession } from "./browser-session.js";
import { RobotsCache } from "./robots.js";
import { getOriginSession } from "./session-store.js";

const SNAPSHOT_EVERY_PAGES = 200;

/** When false, the crawl loop exits. Toggled by the Electron UI or the injected Stop button. */
let isActive = false;

export const setActive = (active: boolean): void => {
    isActive = active;
};

export const crawlIsActive = (): boolean => isActive;

export type CrawlCallbacks = {
    onProgress?: (totalReturned: number) => void;
};

export type CrawlOptions = {
    callbacks?: CrawlCallbacks;
    /** Test hook: replaces the HTTP fetcher. */
    httpFetcher?: HttpFetcher;
    /** Test hook: disables the browser tier entirely. */
    disableBrowser?: boolean;
    scheduler?: DomainScheduler;
    /** Test hook: skip robots.txt checks. */
    ignoreRobots?: boolean;
};

type SiteState = {
    controller: WebsiteController;
    site: string;
    /** Once a site needed the browser tier, keep using it for that site. */
    needsBrowser: boolean;
};

const reportProgress = (store: CrawlStore, states: SiteState[], callbacks?: CrawlCallbacks) => {
    if (!callbacks?.onProgress) {
        return;
    }
    const total = states.reduce((sum, state) => sum + store.countReturned(state.site), 0);
    callbacks.onProgress(total);
};

/** File links (frontier + returned) from one page into the store. */
const storeLinks = (
    store: CrawlStore,
    state: SiteState,
    links: string[],
    depth: number,
): void => {
    const frontier: { url: string; depth: number }[] = [];
    const returned: string[] = [];
    for (const href of links) {
        if (state.controller.canBeVisited(href)) {
            frontier.push({ url: href, depth: depth + 1 });
        }
        if (state.controller.canBeReturned(href)) {
            returned.push(href);
        }
    }
    store.addDiscoveredLinks(state.site, { frontier, returned });
};

/**
 * Tier 0: harvest sitemap/feed sources declared by the controller. The sitemap
 * is fetched once per site (marker in the frontier); the feed on every run.
 */
const harvestDeclaredSources = async (
    store: CrawlStore,
    scheduler: DomainScheduler,
    state: SiteState,
): Promise<void> => {
    const sitemapUrl = state.controller.sitemapUrl?.();
    if (sitemapUrl && !store.hasFrontierUrl(state.site, sitemapUrl)) {
        console.log(`Harvesting sitemap for ${state.site}: ${sitemapUrl}`);
        const result = await collectSitemapUrls(sitemapUrl, scheduler);
        storeLinks(store, state, result.urls, 0);
        store.addFrontierUrl(state.site, sitemapUrl, 0);
        store.markFrontierUrl(state.site, sitemapUrl, "visited");
        console.log(
            `Sitemap harvest for ${state.site}: ${result.urls.length} URLs from ${result.sitemapsVisited} sitemap file(s)${result.truncated ? " (truncated)" : ""}`,
        );
    }
    const feedUrl = state.controller.feedUrl?.();
    if (feedUrl) {
        const urls = await collectFeedUrls(feedUrl, scheduler);
        storeLinks(store, state, urls, 0);
        if (urls.length > 0) {
            console.log(`Feed harvest for ${state.site}: ${urls.length} URLs`);
        }
    }
};

/**
 * Tier 2: load the URL in the headed browser. Handles the Play gate on first
 * use and pauses while the controller reports that the page needs the user.
 */
const fetchViaBrowser = async (
    session: BrowserSession,
    scheduler: DomainScheduler,
    state: SiteState,
    url: string,
): Promise<FetchOutcome | null> => {
    const page = await session.getPage();
    if (!(await session.waitUntilPlaying(() => isActive))) {
        return null;
    }
    // Ignore any block cooldown: the browser is how we clear the challenge that
    // caused it, so it must not wait the cooldown out.
    await scheduler.acquire(url, { ignoreBlock: true });
    let status: number | null = null;
    try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded" });
        status = response?.status() ?? null;
    } catch (error) {
        scheduler.reportResult(url, null);
        return { url, status: null, html: null, links: [], challenge: false, needsBrowser: true, error: String(error) };
    }

    // A managed challenge auto-clears in a real browser within a few seconds.
    // Do NOT touch the DOM here — injecting anything breaks the challenge. Just
    // poll the content until the challenge markers are gone (or the present user
    // solves an interactive one). Up to 40s for slower/interactive challenges.
    let html = await page.content();
    for (let waited = 0; waited < 40_000 && isActive && looksLikeChallenge(status, html); waited += 1500) {
        await page.waitForTimeout(1500);
        html = await page.content();
        status = null; // status was the challenge response; judge by content now.
    }

    // Let a site-specific requireUserAttention pattern pause us (banners, etc.).
    while (isActive && (await state.controller.requireUserAttention(page))) {
        await page.waitForTimeout(500);
    }
    if (!isActive) {
        return null;
    }

    html = await page.content();
    const links = extractLinks(html, page.url());
    // Only treat it as an unsolved challenge when the markers persist AND no
    // usable links came back — a real page that merely mentions a marker word
    // (or embeds a Cloudflare script) must not be discarded.
    const blocked = looksLikeChallenge(status, html) && links.length === 0;
    scheduler.reportResult(url, status, blocked);
    if (blocked) {
        return { url, status, html, links: [], challenge: true, needsBrowser: true };
    }
    // Cleared: now it is safe to (re)inject the overlay and capture the session
    // so the HTTP tier can reuse the earned cookies.
    await session.ensureControlUi();
    await session.captureSession(url);
    return { url, status, html, links, challenge: false, needsBrowser: true };
};

/**
 * Crawl one or more website controllers. HTTP-first: pages are fetched with a
 * plain polite HTTP client and only escalate to a visible browser when a site
 * serves challenges or JS-only shells. Round-robins across sites, so no site
 * receives bursts, and persists everything through the SQLite crawl store.
 */
export const runCrawl = async (
    controllers: WebsiteController[],
    options: CrawlOptions = {},
): Promise<void> => {
    if (controllers.length === 0) {
        return;
    }
    isActive = true;
    const store = await getCrawlStore();
    const scheduler = options.scheduler ?? new DomainScheduler(store);
    const session = new BrowserSession(() => setActive(false));
    const robots = options.ignoreRobots ? null : new RobotsCache(scheduler);
    const callbacks = options.callbacks;

    const states: SiteState[] = controllers.map((controller) => {
        const site = controller.name();
        store.ensureSite(site, controller.initialUrl());
        store.addFrontierUrl(site, controller.initialUrl(), 0);
        return { controller, site, needsBrowser: false };
    });

    try {
        for (const state of states) {
            if (!isActive) {
                break;
            }
            await harvestDeclaredSources(store, scheduler, state);
        }
        reportProgress(store, states, callbacks);

        let roundRobinIndex = 0;
        let pagesProcessed = 0;

        while (isActive) {
            let selected: { state: SiteState; url: string; depth: number; index: number } | undefined;
            let anyPendingButBlocked = false;
            for (let offset = 0; offset < states.length; offset++) {
                const index = (roundRobinIndex + offset) % states.length;
                const state = states[index]!;
                const pending = store.nextPendingUrl(state.site, state.controller.maxDepth());
                if (!pending) {
                    continue;
                }
                if (scheduler.isBlocked(pending.url)) {
                    anyPendingButBlocked = true;
                    continue;
                }
                selected = { state, url: pending.url, depth: pending.depth, index };
                break;
            }

            if (!selected) {
                if (anyPendingButBlocked) {
                    await new Promise((resolve) => setTimeout(resolve, 3_000));
                    continue;
                }
                break;
            }
            roundRobinIndex = (selected.index + 1) % states.length;

            const { state, url, depth } = selected;
            store.markFrontierUrl(state.site, url, "visited");

            if (robots && !(await robots.isAllowed(url))) {
                console.log("robots.txt disallows", url, "- skipping");
                store.markFrontierUrl(state.site, url, "skipped");
                continue;
            }
            console.log("crawling", url, "site", state.site, state.needsBrowser ? "(browser)" : "(http)");

            let outcome: FetchOutcome | null;
            if (state.needsBrowser && !options.disableBrowser) {
                outcome = await fetchViaBrowser(session, scheduler, state, url);
            } else {
                outcome = await fetchViaHttp(url, scheduler, options.httpFetcher);
                if (outcome && (outcome.challenge || outcome.needsBrowser) && !options.disableBrowser) {
                    console.log(`Site ${state.site} needs the browser tier (${outcome.challenge ? "challenge" : "JS shell"}).`);
                    state.needsBrowser = true;
                    store.reopenFrontierUrl(state.site, url, depth);
                    outcome = await fetchViaBrowser(session, scheduler, state, url);
                    if (outcome) {
                        store.markFrontierUrl(state.site, url, "visited");
                    }
                }
            }

            // After the browser cleared a challenge it captured the session's
            // cookies; drop back to the fast HTTP tier and let it re-escalate
            // only if the session lapses.
            if (state.needsBrowser && outcome && !outcome.challenge && !outcome.error && getOriginSession(url)) {
                state.needsBrowser = false;
            }

            if (outcome === null) {
                // Crawl was stopped while waiting on the browser tier.
                store.reopenFrontierUrl(state.site, url, depth);
                break;
            }
            if (outcome.error || (outcome.status !== null && outcome.status >= 400)) {
                store.markFrontierUrl(state.site, url, "failed");
            } else {
                storeLinks(store, state, outcome.links, depth);
            }

            pagesProcessed++;
            reportProgress(store, states, callbacks);
            if (pagesProcessed % SNAPSHOT_EVERY_PAGES === 0) {
                for (const s of states) {
                    store.exportSnapshot(s.site);
                }
            }
        }
    } finally {
        for (const state of states) {
            try {
                store.exportSnapshot(state.site);
                const stats = store.getSiteStats(state.site);
                console.log(
                    `Crawl summary for ${state.site}: collected ${stats.returned} URLs; ` +
                        `pages visited ${stats.visited}, pending ${stats.pending}, failed ${stats.failed}, skipped ${stats.skipped}.`,
                );
                if (stats.returned === 0 && stats.visited > 0) {
                    console.warn(
                        `${state.site}: visited pages but collected nothing — canBeReturned may not match the links on those pages.`,
                    );
                }
            } catch (error) {
                console.error("Failed to export snapshot for", state.site, error);
            }
        }
        reportProgress(store, states, callbacks);
        await session.close();
        isActive = false;
    }
};
