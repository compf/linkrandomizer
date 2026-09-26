import path from "path";
import { fileURLToPath } from "url";
import { chromium, type BrowserContext, type Page } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveProfileDir = async (): Promise<string> => {
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
        const profileDir = await resolveProfileDir();
        this.context = await chromium.launchPersistentContext(profileDir, {
            headless: false,
            viewport: null,
        });
        this.page = this.context.pages()[0] ?? (await this.context.newPage());
        this.playing = false;
        await this.page.exposeFunction("__linkrandomizerCrawlPlay", () => {
            this.playing = true;
        });
        await this.page.exposeFunction("__linkrandomizerCrawlStop", () => {
            this.onStop();
        });
        await this.page.addInitScript(injectCrawlControlUi);
        return this.page;
    }

    async ensureControlUi(): Promise<void> {
        if (this.page && !this.page.isClosed()) {
            try {
                await this.page.evaluate(injectCrawlControlUi);
            } catch {
                // Navigation raced the evaluate; the init script covers the next page.
            }
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
