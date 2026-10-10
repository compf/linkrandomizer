# Link Randomizer

Explore random URLs from interesting websites: historical newspaper issues, news archives,
court filings, and anything else that can be described by a URL generation scheme or collected
by the built-in crawler. Runs as an Electron desktop app (full feature set) or as a plain web
app (URL exploration only).

## Packages

- `packages/common` — shared models and logic: `Website` generation schemes (fixed URL parts +
  random variables like dates and ranges), rankers, AI helpers (URL explanation, period
  briefings), service interfaces used by both frontends.
- `packages/frontend` — Angular UI: URL explorer (random URL cards, date-period filtering,
  notes/tags, AI chat about a URL), website analyzer (crawler + AI schemes), weekly tasks.
- `packages/main` — Electron main process: crawler, storage, AI schema induction, IPC handlers.

## How URLs are produced

Three kinds of sites (classified automatically by AI schema induction):

1. **Generatable** — the URLs follow a scheme (e.g. NYT Time Machine:
   `.../timesmachine/{year}/{month}/{day}/issue.html`). Defined in
   `packages/common/src/models/data/public-websites.ts` or induced by the AI.
2. **Hybrid** — index/archive pages follow a scheme but the result URLs have unguessable slugs
   (e.g. heise: archive is `/newsticker/archiv/{year}/{month}/`, articles are not guessable).
   The scheme enumerates the index pages and the crawler harvests the article links from them;
   re-harvests only fetch the current (still changing) month.
3. **Opaque** — no usable structure; the classic crawler collects a URL pool.

## Crawler (Electron only)

HTTP-first and polite by design:

- Tier 0: sitemap.xml / RSS harvesting when a controller declares them.
- Tier 1: plain HTTP fetch + link extraction.
- Tier 2: a visible browser (persistent profile, Play/Stop overlay) opens only when a site
  serves challenges or JS-only shells; the user clears banners/captchas manually. The window is
  a genuine, un-instrumented browser (it does not advertise automation), so managed challenges
  (e.g. Cloudflare "Just a moment") clear normally.
- Session reuse: once the browser loads a site cleanly, its cookies (including any clearance
  cookie) and User-Agent are shared with the HTTP tier for that origin, so the fast path takes
  over and is not re-challenged on every page; it re-escalates to the browser only if the
  session lapses.
- Per-domain politeness: realistic browser headers, minimum delay with jitter, exponential
  cooldown on 403/429/503 or challenge pages, robots.txt compliance. There is deliberately no
  fingerprint spoofing or captcha-solving — the approach is to use a real browser once and
  reuse the session it earns.

The crawler's browser tier needs a Chromium/Chrome executable. The `postinstall` tries
`npx playwright install chromium`, but that has no build for every OS (e.g. Ubuntu 26.04); when
it is unavailable the crawler automatically uses, in order: `$LINKRANDOMIZER_BROWSER_PATH`, the
newest Chromium in the Playwright cache (`~/.cache/ms-playwright/chromium-*`), or a system
Chrome/Chromium/Edge (`/usr/bin/google-chrome`, `/usr/bin/chromium`, `/usr/bin/microsoft-edge`,
…). If none is found, set `LINKRANDOMIZER_BROWSER_PATH` to any Chromium-based browser binary.

Crawl state lives in SQLite (`better-sqlite3`) in the Electron user-data directory
(`~/.config/@linkrandomizer/main/linkrandomizer.sqlite` on Linux; override with
`LINKRANDOMIZER_DB_PATH`). Crawls are resumable; the frontier and collected URL pools survive
restarts. Slim JSON snapshots are exported to
`packages/common/src/models/data/extracted-urls/` so the web build can serve the pools as
static assets.

## AI schema induction

In the analyzer tab, "Propose scheme" sends a sample of a site's collected URLs to the AI,
which classifies the site and proposes a generation scheme. The proposal is then **verified
against the live site** (sampled URLs are probed; index schemes must actually list matching
links) and stored with its measured hit rate. Verified hybrid schemes get a "Harvest" button.

## Development

```bash
npm run build        # builds common, frontend, main (from the repo root)
npm start            # builds, then launches the Electron app
```

Per-package installs (`npx npm@10 install` also works if the system npm misbehaves). The main
package's `postinstall` rebuilds `better-sqlite3` against the installed Electron version.

Notes:
- On Wayland systems Electron must run with the X11 backend; `npm start` passes
  `--ozone-platform=x11` and `launcher.cjs` self-relaunches with the flag otherwise.
- The OpenAI API key lives in `packages/main/src/config.ts` (gitignored, default export
  string) for Electron; the web app asks for a key in its settings UI.
- The web build is `packages/frontend/dist/frontend/browser` — serve it statically; crawling
  and schema induction are desktop-only, URL exploration works everywhere.
