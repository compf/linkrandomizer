import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, type BrowserContext, type Page } from "playwright";
import { setOriginSession } from "./session-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Common relative locations of the chrome binary inside a browser build dir. */
const CHROME_SUBPATHS = [
    "chrome-linux64/chrome",
    "chrome-linux/chrome",
    "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    "chrome-win/chrome.exe",
];

/** System-installed Chromium-family browsers Playwright can drive as-is. */
const SYSTEM_BROWSERS = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/opt/google/chrome/chrome",
];

const existing = (candidate: string): boolean => {
    try {
        return fs.existsSync(candidate);
    } catch {
        return false;
    }
};

/** Newest chromium build in the Playwright browser cache, if any. */
const findCachedChromium = (): string | undefined => {
    const base =
        process.env.PLAYWRIGHT_BROWSERS_PATH ||
        path.join(os.homedir(), ".cache", "ms-playwright");
    let dirs: string[];
    try {
        dirs = fs
            .readdirSync(base)
            .filter((d) => d.startsWith("chromium-") && !d.includes("headless"));
    } catch {
        return undefined;
    }
    dirs.sort(
        (a, b) => Number(b.split("-")[1] ?? 0) - Number(a.split("-")[1] ?? 0),
    );
    for (const dir of dirs) {
        for (const sub of CHROME_SUBPATHS) {
            const exe = path.join(base, dir, sub);
            if (existing(exe)) {
                return exe;
            }
        }
    }
    return undefined;
};

/**
 * Resolve a Chromium/Chrome executable for the crawler's browser tier.
 * Playwright's own `install` has no build for every OS (e.g. Ubuntu 26.04), so
 * we prefer an existing binary: an explicit override, then the Playwright
 * cache, then a system Chrome/Chromium/Edge. Returns undefined to let Playwright
 * fall back to its bundled default.
 */
export const resolveBrowserExecutable = (): string | undefined => {
    if (process.env.LINKRANDOMIZER_BROWSER_PATH) {
        return process.env.LINKRANDOMIZER_BROWSER_PATH;
    }
    return findCachedChromium() ?? SYSTEM_BROWSERS.find(existing);
};

export const resolveProfileDir = async (): Promise<string> => {
    if (process.env.LINKRANDOMIZER_PROFILE_DIR) {
        return process.env.LINKRANDOMIZER_PROFILE_DIR;
    }
    if (process.versions.electron) {
        try {
            const { app } = await import("electron");
            if (app) {
                return path.join(app.getPath("userData"), "crawl-profile");
            }
        } catch {
            // Not running inside Electron main.
        }
    }
    return path.resolve(__dirname, "../../data/crawl-profile");
};

/**
 * Launch a persistent, visible browser context configured to behave like an
 * ordinary browser (no automation banner). Shared by the crawl loop's browser
 * tier and the controller assistant's evidence gathering, so both pass managed
 * challenges and share the earned session via the same profile directory.
 */
export const launchCrawlContext = async (): Promise<BrowserContext> => {
    const profileDir = await resolveProfileDir();
    const executablePath = resolveBrowserExecutable();
    return chromium.launchPersistentContext(profileDir, {
        headless: false,
        viewport: null,
        ...(executablePath ? { executablePath } : {}),
        ignoreDefaultArgs: ["--enable-automation"],
        args: ["--disable-blink-features=AutomationControlled"],
    });
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

/**
 * Lazily opened, headed browser for pages the HTTP tier cannot handle
 * (challenges, JS shells). Uses a persistent profile so cookies and solved
 * challenges survive between runs, and keeps the manual Play/Stop overlay so
 * the user can clear banners or captchas before crawling continues.
 */
export class BrowserSession {
    private context: BrowserContext | undefined;
    private page: Page | undefined;
    private playing = false;
    private onStop: () => void;

    constructor(onStop: () => void) {
        this.onStop = onStop;
    }

    isOpen(): boolean {
        return this.page !== undefined;
    }

    async getPage(): Promise<Page> {
        if (this.page && !this.page.isClosed()) {
            return this.page;
        }
        // Present as an ordinary browser rather than announcing automation:
        // the "--enable-automation" banner sets navigator.webdriver=true, which
        // some CDNs reject outright. This is a real, user-visible window (the
        // user solves any challenge via the overlay), not a spoofed fingerprint.
        this.context = await launchCrawlContext();
        this.page = this.context.pages()[0] ?? (await this.context.newPage());
        this.playing = false;
        await this.page.exposeFunction("__linkrandomizerCrawlPlay", () => {
            this.playing = true;
        });
        await this.page.exposeFunction("__linkrandomizerCrawlStop", () => {
            this.onStop();
        });
        // NOTE: deliberately no addInitScript here. Injecting our overlay into a
        // page mutates its DOM on every navigation — including a Cloudflare
        // challenge page, which breaks the challenge. The overlay is injected
        // explicitly via ensureControlUi() only once a page has cleared.
        return this.page;
    }

    /**
     * Inject the Play/Stop overlay — but never onto a bot-protection challenge
     * page, because mutating that page's DOM makes the challenge fail. Callers
     * use this only for pages known to have cleared (or the initial blank page).
     */
    async ensureControlUi(): Promise<void> {
        if (!this.page || this.page.isClosed()) {
            return;
        }
        try {
            const onChallenge = await this.page.evaluate(() =>
                /just a moment|challenge-platform|_cf_chl_opt|enable javascript and cookies/i.test(
                    document.documentElement.innerHTML.slice(0, 4000),
                ),
            );
            if (onChallenge) {
                return;
            }
            await this.page.evaluate(injectCrawlControlUi);
        } catch {
            // Navigation raced the evaluate; a later ensureControlUi covers it.
        }
    }

    /**
     * Wait until the user pressed Play in the overlay. Returns false when the
     * crawl was deactivated while waiting.
     */
    async waitUntilPlaying(isActive: () => boolean): Promise<boolean> {
        const page = await this.getPage();
        while (!this.playing) {
            if (!isActive()) {
                return false;
            }
            await page.waitForTimeout(200);
            await this.ensureControlUi();
        }
        return true;
    }

    /**
     * Capture the current page's cookies + User-Agent into the shared session
     * store, so the fast HTTP tier can reuse the session (e.g. a clearance
     * cookie the user just earned) instead of being re-challenged per page.
     */
    async captureSession(url: string): Promise<void> {
        if (!this.context || !this.page || this.page.isClosed()) {
            return;
        }
        try {
            const cookies = await this.context.cookies(url);
            const userAgent = await this.page.evaluate(() => navigator.userAgent);
            setOriginSession(
                url,
                userAgent,
                cookies.map((c) => ({ name: c.name, value: c.value })),
            );
        } catch (error) {
            console.error("Failed to capture browser session for", url, error);
        }
    }

    async close(): Promise<void> {
        try {
            await this.context?.close();
        } catch {
            // Already closed.
        }
        this.context = undefined;
        this.page = undefined;
        this.playing = false;
    }
}
