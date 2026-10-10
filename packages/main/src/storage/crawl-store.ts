import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { extractDateFromString } from "@linkrandomizer/common";
import type { ExtractedUrls } from "../../url-finder-type.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Legacy JSON blobs; still read once for migration and written as slim snapshots for the web build. */
export const EXTRACTED_URLS_DIR = path.resolve(
    __dirname,
    "../../../common/src/models/data/extracted-urls",
);

export type FrontierStatus = "pending" | "visited" | "failed" | "skipped";

export type PendingUrl = { url: string; depth: number };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sites (
    name TEXT PRIMARY KEY,
    initial_url TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS frontier (
    site TEXT NOT NULL,
    url TEXT NOT NULL,
    depth INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    last_visited INTEGER,
    PRIMARY KEY (site, url)
);
CREATE INDEX IF NOT EXISTS idx_frontier_pending ON frontier(site, status, depth);
CREATE TABLE IF NOT EXISTS urls (
    site TEXT NOT NULL,
    url TEXT NOT NULL,
    year INTEGER,
    month INTEGER,
    day INTEGER,
    discovered_at INTEGER NOT NULL,
    PRIMARY KEY (site, url)
);
CREATE INDEX IF NOT EXISTS idx_urls_site_date ON urls(site, year, month);
CREATE TABLE IF NOT EXISTS fetch_log (
    domain TEXT NOT NULL,
    ts INTEGER NOT NULL,
    status INTEGER
);
CREATE INDEX IF NOT EXISTS idx_fetch_log_domain ON fetch_log(domain, ts);
CREATE TABLE IF NOT EXISTS schemas (
    name TEXT PRIMARY KEY,
    definition_json TEXT NOT NULL,
    hit_rate REAL,
    verified_at INTEGER
);
`;

export class CrawlStore {
    private db: Database.Database;

    constructor(dbPath: string) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.exec(SCHEMA);
    }

    hasSite(site: string): boolean {
        return this.db.prepare("SELECT 1 FROM sites WHERE name = ?").get(site) !== undefined;
    }

    listSites(): { name: string; initialUrl: string }[] {
        return this.db
            .prepare("SELECT name, initial_url AS initialUrl FROM sites ORDER BY name")
            .all() as { name: string; initialUrl: string }[];
    }

    ensureSite(site: string, initialUrl: string): void {
        this.db
            .prepare(
                `INSERT INTO sites (name, initial_url, updated_at) VALUES (?, ?, ?)
                 ON CONFLICT(name) DO UPDATE SET initial_url = excluded.initial_url, updated_at = excluded.updated_at`,
            )
            .run(site, initialUrl, Date.now());
    }

    /** Insert-or-ignore, so re-seeding an already visited/pending URL never resets it. */
    addFrontierUrl(site: string, url: string, depth: number): void {
        this.db
            .prepare("INSERT OR IGNORE INTO frontier (site, url, depth, status) VALUES (?, ?, ?, 'pending')")
            .run(site, url, depth);
    }

    hasFrontierUrl(site: string, url: string): boolean {
        return (
            this.db.prepare("SELECT 1 FROM frontier WHERE site = ? AND url = ?").get(site, url) !==
            undefined
        );
    }

    /** Set an already known frontier URL back to pending (e.g. a mutable index page). */
    reopenFrontierUrl(site: string, url: string, depth = 0): void {
        this.db
            .prepare(
                `INSERT INTO frontier (site, url, depth, status) VALUES (?, ?, ?, 'pending')
                 ON CONFLICT(site, url) DO UPDATE SET status = 'pending'`,
            )
            .run(site, url, depth);
    }

    nextPendingUrl(site: string, maxDepth: number): PendingUrl | undefined {
        return this.db
            .prepare(
                "SELECT url, depth FROM frontier WHERE site = ? AND status = 'pending' AND depth < ? LIMIT 1",
            )
            .get(site, maxDepth) as PendingUrl | undefined;
    }

    markFrontierUrl(site: string, url: string, status: FrontierStatus): void {
        this.db
            .prepare("UPDATE frontier SET status = ?, last_visited = ? WHERE site = ? AND url = ?")
            .run(status, Date.now(), site, url);
    }

    addReturnedUrl(site: string, url: string): void {
        const date = extractDateFromString(url);
        this.db
            .prepare(
                "INSERT OR IGNORE INTO urls (site, url, year, month, day, discovered_at) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .run(site, url, date.year ?? null, date.month ?? null, date.day ?? null, Date.now());
    }

    /** All links harvested from one page, applied in a single transaction. */
    addDiscoveredLinks(
        site: string,
        links: { frontier: { url: string; depth: number }[]; returned: string[] },
    ): void {
        this.db.transaction(() => {
            for (const entry of links.frontier) {
                this.addFrontierUrl(site, entry.url, entry.depth);
            }
            for (const url of links.returned) {
                this.addReturnedUrl(site, url);
            }
        })();
    }

    countReturned(site: string): number {
        const row = this.db.prepare("SELECT COUNT(*) AS c FROM urls WHERE site = ?").get(site) as {
            c: number;
        };
        return row.c;
    }

    getPool(site: string): string[] {
        return (this.db.prepare("SELECT url FROM urls WHERE site = ?").all(site) as { url: string }[]).map(
            (row) => row.url,
        );
    }

    getRandomUrls(site: string, count: number, period?: { year?: number; month?: number }): string[] {
        const conditions = ["site = ?"];
        const params: unknown[] = [site];
        if (period?.year !== undefined) {
            conditions.push("year = ?");
            params.push(period.year);
        }
        if (period?.month !== undefined) {
            conditions.push("month = ?");
            params.push(period.month);
        }
        params.push(count);
        return (
            this.db
                .prepare(
                    `SELECT url FROM urls WHERE ${conditions.join(" AND ")} ORDER BY RANDOM() LIMIT ?`,
                )
                .all(...params) as { url: string }[]
        ).map((row) => row.url);
    }

    /** Random sample of already visited frontier URLs (typically index/archive pages). */
    getVisitedFrontierSample(site: string, count: number): string[] {
        return (
            this.db
                .prepare(
                    "SELECT url FROM frontier WHERE site = ? AND status = 'visited' ORDER BY RANDOM() LIMIT ?",
                )
                .all(site, count) as { url: string }[]
        ).map((row) => row.url);
    }

    saveSchema(site: string, definition: unknown, hitRate: number | null): void {
        this.db
            .prepare(
                `INSERT INTO schemas (name, definition_json, hit_rate, verified_at) VALUES (?, ?, ?, ?)
                 ON CONFLICT(name) DO UPDATE SET definition_json = excluded.definition_json,
                     hit_rate = excluded.hit_rate, verified_at = excluded.verified_at`,
            )
            .run(site, JSON.stringify(definition), hitRate, Date.now());
    }

    listSchemas(): { name: string; definition: unknown; hitRate: number | null; verifiedAt: number | null }[] {
        const rows = this.db
            .prepare("SELECT name, definition_json, hit_rate, verified_at FROM schemas ORDER BY name")
            .all() as { name: string; definition_json: string; hit_rate: number | null; verified_at: number | null }[];
        const result: { name: string; definition: unknown; hitRate: number | null; verifiedAt: number | null }[] = [];
        for (const row of rows) {
            try {
                result.push({
                    name: row.name,
                    definition: JSON.parse(row.definition_json),
                    hitRate: row.hit_rate,
                    verifiedAt: row.verified_at,
                });
            } catch {
                console.error("Skipping corrupt schema row:", row.name);
            }
        }
        return result;
    }

    deleteSchema(site: string): void {
        this.db.prepare("DELETE FROM schemas WHERE name = ?").run(site);
    }

    /** Remove all crawl data for a site: frontier, collected URLs, schema, and the site row. */
    deleteSite(site: string): void {
        this.db.transaction(() => {
            this.db.prepare("DELETE FROM frontier WHERE site = ?").run(site);
            this.db.prepare("DELETE FROM urls WHERE site = ?").run(site);
            this.db.prepare("DELETE FROM schemas WHERE name = ?").run(site);
            this.db.prepare("DELETE FROM sites WHERE name = ?").run(site);
        })();
        const snapshot = path.join(EXTRACTED_URLS_DIR, `${site}.json`);
        try {
            if (fs.existsSync(snapshot)) {
                fs.unlinkSync(snapshot);
            }
        } catch (error) {
            console.error("Failed to remove snapshot for", site, error);
        }
    }

    /** Per-site frontier + pool counts, for the crawl summary and UI. */
    getSiteStats(site: string): {
        pending: number;
        visited: number;
        failed: number;
        skipped: number;
        returned: number;
    } {
        const rows = this.db
            .prepare("SELECT status, COUNT(*) AS c FROM frontier WHERE site = ? GROUP BY status")
            .all(site) as { status: string; c: number }[];
        const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.c]));
        return {
            pending: byStatus.pending ?? 0,
            visited: byStatus.visited ?? 0,
            failed: byStatus.failed ?? 0,
            skipped: byStatus.skipped ?? 0,
            returned: this.countReturned(site),
        };
    }

    logFetch(domain: string, status: number | null): void {
        this.db.prepare("INSERT INTO fetch_log (domain, ts, status) VALUES (?, ?, ?)").run(
            domain,
            Date.now(),
            status,
        );
    }

    /** Import one legacy ExtractedUrls blob. No-op when the site already exists in the DB. */
    importLegacyExtractedUrls(site: string, legacy: ExtractedUrls): boolean {
        if (this.hasSite(site)) {
            return false;
        }
        this.db.transaction(() => {
            this.ensureSite(site, legacy.name);
            for (const [url, depth] of Object.entries(legacy.urlsToVisit)) {
                if (depth === null) {
                    this.db
                        .prepare(
                            "INSERT OR IGNORE INTO frontier (site, url, depth, status, last_visited) VALUES (?, ?, 0, 'visited', ?)",
                        )
                        .run(site, url, Date.now());
                } else {
                    this.addFrontierUrl(site, url, depth);
                }
            }
            for (const url of legacy.urlsToReturn) {
                this.addReturnedUrl(site, url);
            }
        })();
        return true;
    }

    /**
     * Write a slim snapshot in the legacy ExtractedUrls shape (empty frontier) so the
     * web build keeps serving the pool as a static asset.
     */
    exportSnapshot(site: string, dir: string = EXTRACTED_URLS_DIR): string {
        const initialUrl =
            (this.db.prepare("SELECT initial_url AS u FROM sites WHERE name = ?").get(site) as
                | { u: string }
                | undefined)?.u ?? site;
        const snapshot: ExtractedUrls = {
            name: initialUrl,
            urlsToVisit: {},
            urlsToReturn: this.getPool(site),
        };
        fs.mkdirSync(dir, { recursive: true });
        const outputPath = path.join(dir, `${site}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
        return outputPath;
    }

    close(): void {
        this.db.close();
    }
}

const migrateLegacyFiles = (store: CrawlStore) => {
    if (!fs.existsSync(EXTRACTED_URLS_DIR)) {
        return;
    }
    for (const file of fs.readdirSync(EXTRACTED_URLS_DIR).filter((f) => f.endsWith(".json"))) {
        const site = path.basename(file, ".json");
        try {
            const parsed = JSON.parse(
                fs.readFileSync(path.join(EXTRACTED_URLS_DIR, file), "utf8"),
            ) as ExtractedUrls;
            if (parsed && typeof parsed.name === "string" && Array.isArray(parsed.urlsToReturn)) {
                if (store.importLegacyExtractedUrls(site, parsed)) {
                    console.log(`Migrated legacy extracted URLs for "${site}" into the crawl DB.`);
                }
            }
        } catch (error) {
            console.error(`Skipping legacy extracted-urls file ${file}:`, error);
        }
    }
};

const resolveDefaultDbPath = async (): Promise<string> => {
    const fromEnv = process.env.LINKRANDOMIZER_DB_PATH;
    if (fromEnv) {
        return fromEnv;
    }
    if (process.versions.electron) {
        try {
            const { app } = await import("electron");
            if (app) {
                return path.join(app.getPath("userData"), "linkrandomizer.sqlite");
            }
        } catch {
            // Not running inside Electron main; fall through to the repo-local path.
        }
    }
    return path.resolve(__dirname, "../../data/linkrandomizer.sqlite");
};

let storePromise: Promise<CrawlStore> | undefined;

export const getCrawlStore = (): Promise<CrawlStore> => {
    if (!storePromise) {
        storePromise = (async () => {
            const dbPath = await resolveDefaultDbPath();
            const store = new CrawlStore(dbPath);
            migrateLegacyFiles(store);
            console.log("Crawl store opened at", dbPath);
            return store;
        })();
    }
    return storePromise;
};
