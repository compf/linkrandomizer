import {
    type YoutubeFetchProgress,
    type YoutubeSource,
    type YoutubeVideo,
    channelIdPattern,
    parseYoutubeTarget,
    videoUrl,
} from "@linkrandomizer/common";

const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const CLIENT_VERSION = "2.20251101.00.00";
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_VIDEOS = 20000;
const MAX_PAGES = 400;
const DATE_CONCURRENCY = 4;

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class YoutubeFetchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "YoutubeFetchError";
    }
}

export type YoutubeFetchOptions = {
    maxVideos?: number;
    includeDates?: boolean;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return undefined;
};

const dig = (root: unknown, path: string[]): unknown => {
    let current: unknown = root;
    for (const key of path) {
        const record = asRecord(current);
        if (!record) {
            return undefined;
        }
        current = record[key];
    }
    return current;
};

const decodeHtml = (value: string): string =>
    value
        .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");

const cleanTitle = (value: string): string => value.replace(/\s+/g, " ").trim();

const firstContent = (node: unknown, depth = 0): string | undefined => {
    if (depth > 8 || node == null) {
        return undefined;
    }
    if (Array.isArray(node)) {
        for (const entry of node) {
            const found = firstContent(entry, depth + 1);
            if (found) {
                return found;
            }
        }
        return undefined;
    }
    const record = asRecord(node);
    if (!record) {
        return undefined;
    }
    const content = record["content"];
    if (typeof content === "string" && content.trim()) {
        return cleanTitle(content);
    }
    const simple = record["simpleText"];
    if (typeof simple === "string" && simple.trim()) {
        return cleanTitle(simple);
    }
    for (const value of Object.values(record)) {
        const found = firstContent(value, depth + 1);
        if (found) {
            return found;
        }
    }
    return undefined;
};

const titleFromLockup = (lockup: Record<string, unknown>): string => {
    const titled = firstContent(dig(lockup, ["metadata", "lockupMetadataViewModel", "title"]));
    if (titled) {
        return titled;
    }
    return firstContent(lockup["metadata"]) ?? "Untitled";
};

const continuationToken = (record: Record<string, unknown>): string | undefined => {
    const modern = dig(record, [
        "continuationItemViewModel",
        "continuationCommand",
        "innertubeCommand",
        "continuationCommand",
        "token",
    ]);
    if (typeof modern === "string" && modern.length > 20) {
        return modern;
    }
    const legacy = dig(record, [
        "continuationItemRenderer",
        "continuationEndpoint",
        "continuationCommand",
        "token",
    ]);
    if (typeof legacy === "string" && legacy.length > 20) {
        return legacy;
    }
    return undefined;
};

const collectListing = (
    node: unknown,
    videos: { id: string; title: string }[],
    tokens: string[],
    depth: number,
): void => {
    if (depth > 60 || node == null) {
        return;
    }
    if (Array.isArray(node)) {
        for (const entry of node) {
            collectListing(entry, videos, tokens, depth + 1);
        }
        return;
    }
    const record = asRecord(node);
    if (!record) {
        return;
    }
    const lockup = asRecord(record["lockupViewModel"]);
    if (lockup) {
        const id = lockup["contentId"];
        const contentType = lockup["contentType"];
        if (
            typeof id === "string"
            && VIDEO_ID.test(id)
            && (contentType === undefined || contentType === "LOCKUP_CONTENT_TYPE_VIDEO")
        ) {
            videos.push({ id, title: titleFromLockup(lockup) });
        }
    }
    const token = continuationToken(record);
    if (token) {
        tokens.push(token);
    }
    for (const value of Object.values(record)) {
        if (value !== null && typeof value === "object") {
            collectListing(value, videos, tokens, depth + 1);
        }
    }
};

async function postJson(endpoint: "browse" | "player", payload: Record<string, unknown>): Promise<unknown> {
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
        let response: Response;
        try {
            response = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${INNERTUBE_KEY}&prettyPrint=false`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": USER_AGENT,
                    Origin: "https://www.youtube.com",
                    Referer: "https://www.youtube.com/",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                body: JSON.stringify({
                    context: {
                        client: {
                            clientName: "WEB",
                            clientVersion: CLIENT_VERSION,
                            hl: "en",
                            gl: "US",
                        },
                    },
                    ...payload,
                }),
                signal: AbortSignal.timeout(30_000),
            });
        } catch (error) {
            if (attempt === 2) {
                const message = error instanceof Error ? error.message : String(error);
                throw new YoutubeFetchError(`Could not reach YouTube (${message}).`);
            }
            await sleep(800 * (attempt + 1));
            continue;
        }
        if (response.status === 429 || response.status >= 500) {
            lastStatus = response.status;
            await sleep(800 * (attempt + 1));
            continue;
        }
        if (!response.ok) {
            throw new YoutubeFetchError(`YouTube returned ${response.status} while loading this catalog.`);
        }
        try {
            return await response.json() as unknown;
        } catch {
            throw new YoutubeFetchError("YouTube sent a response that was not JSON.");
        }
    }
    throw new YoutubeFetchError(
        lastStatus === 429
            ? "YouTube rate-limited the catalog download. Wait a minute and try again."
            : `YouTube returned ${lastStatus || "an error"} while loading this catalog.`,
    );
}

const uploadsPlaylistId = (channelId: string): string => {
    if (!channelIdPattern.test(channelId)) {
        throw new YoutubeFetchError("That channel id doesn't look right.");
    }
    return `UU${channelId.slice(2)}`;
};

const metaContent = (html: string, property: string): string | undefined => {
    const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, "i"))?.[0]
        ?? html.match(new RegExp(`<meta[^>]+content=["'][^"']*["'][^>]+(?:property|name)=["']${property}["'][^>]*>`, "i"))?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    return content ? decodeHtml(content).trim() : undefined;
};

const channelTitleFromHtml = (html: string): string | undefined => {
    const og = metaContent(html, "og:title");
    const raw = og || html.match(/<title>([^<]+)<\/title>/i)?.[1];
    if (!raw) {
        return undefined;
    }
    return decodeHtml(raw).replace(/\s+-\s+YouTube\s*$/i, "").trim() || undefined;
};

async function resolveChannelPage(pageUrl: string): Promise<{ channelId: string; title?: string }> {
    let response: Response;
    try {
        response = await fetch(pageUrl, {
            headers: {
                "User-Agent": USER_AGENT,
                "Accept-Language": "en-US,en;q=0.9",
                Cookie: "SOCS=CAI; CONSENT=YES+",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(30_000),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new YoutubeFetchError(`Could not open that channel page (${message}).`);
    }
    if (!response.ok) {
        throw new YoutubeFetchError(`YouTube returned ${response.status} for that channel page.`);
    }
    const html = await response.text();
    if (html.includes("consent.youtube.com") && !html.includes("externalId")) {
        throw new YoutubeFetchError("YouTube asked for cookie consent before showing this channel. Paste the /channel/UC… URL instead.");
    }
    const channelId = html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/)?.[1]
        ?? html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']https?:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i)?.[1]
        ?? html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/)?.[1];
    if (!channelId) {
        throw new YoutubeFetchError("Couldn't find a channel id on that page. Paste a youtube.com/channel/UC… URL.");
    }
    const title = channelTitleFromHtml(html);
    return title ? { channelId, title } : { channelId };
}

const stripUploadsPrefix = (title: string): string =>
    title.replace(/^Uploads from\s+/i, "").trim();

async function listPlaylist(
    playlistId: string,
    maxVideos: number,
    onProgress?: (progress: YoutubeFetchProgress) => void,
): Promise<{ title: string; videos: { id: string; title: string }[]; truncated: boolean }> {
    const byId = new Map<string, { id: string; title: string }>();
    const seenTokens = new Set<string>();
    let continuation: string | undefined;
    let title = "";
    let truncated = false;

    for (let page = 0; page < MAX_PAGES && byId.size < maxVideos; page++) {
        const data = await postJson("browse", continuation
            ? { continuation }
            : { browseId: `VL${playlistId}` });
        if (!title) {
            const found = dig(data, ["metadata", "playlistMetadataRenderer", "title"]);
            if (typeof found === "string" && found.trim()) {
                title = cleanTitle(found);
            }
        }
        const foundVideos: { id: string; title: string }[] = [];
        const tokens: string[] = [];
        collectListing(data, foundVideos, tokens, 0);
        let added = 0;
        for (const video of foundVideos) {
            if (byId.has(video.id)) {
                continue;
            }
            if (byId.size >= maxVideos) {
                truncated = true;
                break;
            }
            byId.set(video.id, video);
            added++;
        }
        onProgress?.({ message: `Finding videos… ${byId.size} so far` });
        if (byId.size >= maxVideos) {
            truncated = truncated || tokens.length > 0;
            break;
        }
        const next = [...tokens].reverse().find((token) => !seenTokens.has(token));
        if (!next || added === 0) {
            if (byId.size === 0) {
                const alert = firstContent(dig(data, ["alerts"]));
                throw new YoutubeFetchError(alert || "No videos were found. The playlist may be private, empty, or unavailable.");
            }
            break;
        }
        seenTokens.add(next);
        continuation = next;
    }

    return { title, videos: [...byId.values()], truncated };
}

async function publishDate(videoId: string): Promise<string> {
    try {
        const data = await postJson("player", {
            videoId,
            contentCheckOk: true,
            racyCheckOk: true,
        });
        const raw = dig(data, ["microformat", "playerMicroformatRenderer", "publishDate"])
            ?? dig(data, ["microformat", "playerMicroformatRenderer", "uploadDate"]);
        if (typeof raw !== "string") {
            return "";
        }
        const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
        return match?.[1] ?? "";
    } catch {
        return "";
    }
}

async function attachDates(
    items: { id: string; title: string }[],
    onProgress?: (progress: YoutubeFetchProgress) => void,
): Promise<YoutubeVideo[]> {
    const videos: YoutubeVideo[] = items.map((item) => ({
        id: item.id,
        title: item.title,
        published: "",
        url: videoUrl(item.id),
    }));
    let done = 0;
    let cursor = 0;
    const worker = async () => {
        while (cursor < videos.length) {
            const index = cursor;
            cursor += 1;
            const video = videos[index];
            if (!video) {
                return;
            }
            await sleep(40);
            video.published = await publishDate(video.id);
            done += 1;
            if (done === videos.length || done % 5 === 0) {
                onProgress?.({ message: `Reading publish dates… ${done} of ${videos.length}` });
            }
        }
    };
    const workers = Math.min(DATE_CONCURRENCY, videos.length);
    if (workers > 0) {
        await Promise.all(Array.from({ length: workers }, () => worker()));
    }
    videos.sort((left, right) => right.published.localeCompare(left.published));
    return videos;
}

export async function fetchYoutubeCatalog(
    input: string,
    onProgress?: (progress: YoutubeFetchProgress) => void,
    options?: YoutubeFetchOptions,
): Promise<{ source: YoutubeSource; warning?: string }> {
    const parsed = parseYoutubeTarget(input);
    if (!parsed.ok) {
        throw new YoutubeFetchError(parsed.error);
    }
    const maxVideos = Math.min(MAX_VIDEOS, Math.max(1, options?.maxVideos ?? MAX_VIDEOS));
    const includeDates = options?.includeDates !== false;

    let playlistId: string;
    let kind: YoutubeSource["kind"];
    let channelId = "";
    let titleHint = "";

    if (parsed.target.kind === "playlist") {
        playlistId = parsed.target.playlistId;
        kind = "playlist";
    } else if (parsed.target.kind === "channel") {
        channelId = parsed.target.channelId;
        playlistId = uploadsPlaylistId(channelId);
        kind = "channel";
    } else {
        onProgress?.({ message: "Resolving the channel…" });
        const resolved = await resolveChannelPage(parsed.target.pageUrl);
        channelId = resolved.channelId;
        titleHint = resolved.title ?? "";
        playlistId = uploadsPlaylistId(channelId);
        kind = "channel";
    }

    onProgress?.({ message: "Opening the video list…" });
    const listed = await listPlaylist(playlistId, maxVideos, onProgress);
    const title = kind === "channel"
        ? (titleHint || stripUploadsPrefix(listed.title) || listed.title || channelId)
        : (listed.title || playlistId);
    const videos = includeDates
        ? await attachDates(listed.videos, onProgress)
        : listed.videos.map((item) => ({
            id: item.id,
            title: item.title,
            published: "",
            url: videoUrl(item.id),
        }));

    const source: YoutubeSource = {
        id: kind === "channel" ? `channel:${channelId}` : `playlist:${playlistId}`,
        kind,
        title,
        sourceUrl: kind === "channel"
            ? `https://www.youtube.com/channel/${channelId}`
            : `https://www.youtube.com/playlist?list=${playlistId}`,
        fetchedAt: new Date().toISOString(),
        videos,
    };

    const missing = videos.filter((video) => video.published === "").length;
    const parts: string[] = [];
    if (listed.truncated) {
        parts.push(`Saved the first ${videos.length} videos.`);
    }
    if (includeDates && missing > 0) {
        parts.push(`${missing} ${missing === 1 ? "video has" : "videos have"} no publish date, so they only appear for Any time.`);
    }
    const warning = parts.join(" ");
    return warning ? { source, warning } : { source };
}
