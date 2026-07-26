import type { Page } from "playwright";
import fs from "fs";
import { sendToControlWindow } from "../mainBackend.js";
import type { ExtractedUrls, WebsiteController } from "../../url-finder-type.js";
import path from "path";

const SAVE_FREQUENCY = 1000;
const EXTRACTED_URLS_DIR =
    "/home/compf/data/linkrandomizer/packages/common/src/models/data/extracted-urls";

/** When false, the crawl loop exits. Toggled by Electron UI or the injected Stop button. */
let isActive = false;
/** When false, the crawl waits (e.g. for the user to dismiss cookie banners and click Play). */
let isPlaying = false;

export const setActive = (active: boolean) => {
    isActive = active;
    if (!active) {
        isPlaying = false;
    }
};

type SiteCrawlState = {
    controller: WebsiteController;
    visitedUrls: Record<string, number | null>;
    urlsToReturn: Record<string, 1>;
    linkCounter: number;
};

const join = (part1: string, part2: string, separator: string) => {
    if (part1.endsWith(separator) && !part2.startsWith(separator)) {
        return part1 + part2;
    } else if (part2.startsWith(separator) && !part1.endsWith(separator)) {
        return part1 + part2;
    } else if (!part1.endsWith(separator) && !part2.startsWith(separator)) {
        return part1 + separator + part2;
    } else {
        return part1.slice(0, -separator.length) + separator + part2.slice(separator.length);
    }
};

const findPendingUrl = (state: SiteCrawlState): string | undefined => {
    const maxDepth = state.controller.maxDepth();
    return Object.keys(state.visitedUrls).find((url) => {
        const depth = state.visitedUrls[url];
        return depth !== null && depth !== undefined && depth < maxDepth;
    });
};

const saveState = (state: SiteCrawlState) => {
    const extractedUrls: ExtractedUrls = {
        name: state.controller.initialUrl(),
        urlsToVisit: state.visitedUrls,
        urlsToReturn: Object.keys(state.urlsToReturn),
    };
    const outputPath = path.join(EXTRACTED_URLS_DIR, state.controller.name() + ".json");
    fs.writeFileSync(outputPath, JSON.stringify(extractedUrls, null, 2));
};

const reportProgress = (states: SiteCrawlState[]) => {
    const total = states.reduce(
        (sum, state) =>
            sum +
            Object.keys(state.visitedUrls).filter((url) => state.controller.canBeReturned(url)).length,
        0,
    );
    sendToControlWindow("webSiteAnalysisStateChanged", total);
};

const injectCrawlControlUi = () => {
    const existing = document.getElementById("__linkrandomizer-crawl-control");
    if (existing) {
        return;
    }

    const root = document.createElement("div");
    root.id = "__linkrandomizer-crawl-control";
    root.setAttribute(
        "style",
        [
            "position:fixed",
            "top:12px",
            "right:12px",
            "z-index:2147483647",
            "display:flex",
            "gap:8px",
            "align-items:center",
            "padding:10px 12px",
            "background:#111827",
            "color:#f9fafb",
            "font:600 13px/1.2 system-ui,sans-serif",
            "border-radius:10px",
            "box-shadow:0 8px 24px rgba(0,0,0,.35)",
            "border:1px solid rgba(255,255,255,.12)",
        ].join(";"),
    );

    const label = document.createElement("span");
    label.id = "__linkrandomizer-crawl-label";
    label.textContent = "Paused — clear banners, then Play";
    label.setAttribute("style", "max-width:220px");

    const buttonStyle =
        "border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font:600 13px/1 system-ui,sans-serif";

    const playBtn = document.createElement("button");
    playBtn.id = "__linkrandomizer-crawl-play";
    playBtn.textContent = "Play";
    playBtn.setAttribute("style", buttonStyle + ";background:#16a34a;color:white");
    playBtn.onclick = () => {
        (window as any).__linkrandomizerCrawlPlay?.();
        label.textContent = "Crawling…";
        playBtn.setAttribute("disabled", "true");
        playBtn.style.opacity = "0.6";
        playBtn.style.cursor = "default";
    };

    const stopBtn = document.createElement("button");
    stopBtn.id = "__linkrandomizer-crawl-stop";
    stopBtn.textContent = "Stop";
    stopBtn.setAttribute("style", buttonStyle + ";background:#dc2626;color:white");
    stopBtn.onclick = () => {
        (window as any).__linkrandomizerCrawlStop?.();
        label.textContent = "Stopped";
        playBtn.setAttribute("disabled", "true");
        stopBtn.setAttribute("disabled", "true");
    };

    root.appendChild(label);
    root.appendChild(playBtn);
    root.appendChild(stopBtn);
    document.documentElement.appendChild(root);
};

const setupCrawlControls = async (page: Page) => {
    isPlaying = false;

    await page.exposeFunction("__linkrandomizerCrawlPlay", () => {
        isPlaying = true;
    });
    await page.exposeFunction("__linkrandomizerCrawlStop", () => {
        setActive(false);
    });
    await page.addInitScript(injectCrawlControlUi);
};

const ensureControlUi = async (page: Page) => {
    await page.evaluate(injectCrawlControlUi);
};

/**
 * Crawl one or more website controllers, alternating between them so no single
 * site receives a burst of consecutive requests.
 */
export const findURLS = async (page: Page, controllers: WebsiteController[]): Promise<void> => {
    if (controllers.length === 0) {
        return;
    }

    isActive = true;
    await setupCrawlControls(page);

    const states: SiteCrawlState[] = controllers.map((controller) => {
        const initialUrl = controller.initialUrl();
        return {
            controller,
            visitedUrls: { [initialUrl]: 0 },
            urlsToReturn: {},
            linkCounter: 0,
        };
    });

    const firstState = states[0]!;

    // Land on the first site so the user can dismiss cookie banners before Play.
    await page.goto(firstState.controller.initialUrl(), { waitUntil: "domcontentloaded" });
    await ensureControlUi(page);

    while (isActive && !isPlaying) {
        await page.waitForTimeout(200);
        await ensureControlUi(page);
    }
    if (!isActive) {
        return;
    }

    let roundRobinIndex = 0;
    let attentionController = firstState.controller;

    while (isActive) {
        await page.waitForTimeout(250);

        if (!isPlaying || !isActive) {
            if (!isActive) {
                break;
            }
            continue;
        }

        // Pause while the current page still needs manual handling (captcha, etc.).
        if (await attentionController.requireUserAttention(page)) {
            continue;
        }

        let selected: { state: SiteCrawlState; url: string; index: number } | undefined;
        for (let offset = 0; offset < states.length; offset++) {
            const index = (roundRobinIndex + offset) % states.length;
            const state = states[index]!;
            const url = findPendingUrl(state);
            if (url) {
                selected = { state, url, index };
                break;
            }
        }

        if (!selected) {
            break;
        }

        // Next iteration prefers the following site (fair alternation).
        roundRobinIndex = (selected.index + 1) % states.length;

        const { state, url: currUrl } = selected;
        const currDepth = state.visitedUrls[currUrl]!;
        state.visitedUrls[currUrl] = null;
        attentionController = state.controller;

        console.log("going to url", currUrl, "site", state.controller.name());
        await page.goto(currUrl, { waitUntil: "domcontentloaded" });
        await ensureControlUi(page);

        if (!isActive) {
            break;
        }

        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("a"))
                .map((link) => link.getAttribute("href"))
                .filter((href): href is string => href !== null && href !== undefined);
        });

        for (const link of links) {
            let href = link;
            if (href && !href.startsWith("http")) {
                href = join(state.controller.parentDomain(), href, "/");
            }
            if (href && state.visitedUrls[href] === undefined && state.controller.canBeVisited(href)) {
                state.visitedUrls[href] = currDepth + 1;
            }
            if (href && state.controller.canBeReturned(href)) {
                state.urlsToReturn[href] = 1;
            }
            state.linkCounter++;
            if (state.linkCounter % SAVE_FREQUENCY === 0) {
                saveState(state);
            }
        }

        reportProgress(states);
    }

    for (const state of states) {
        saveState(state);
    }
    reportProgress(states);
    setActive(false);
};
