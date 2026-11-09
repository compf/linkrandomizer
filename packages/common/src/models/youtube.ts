import { type DatePeriod, type ExtractedDate, dateMatchesPeriod } from "./date-period.js";

export type YoutubeVideo = {
    id: string;
    title: string;
    /** Calendar publish date, YYYY-MM-DD, or empty when YouTube did not provide one. */
    published: string;
    url: string;
};

export type YoutubeSourceKind = "channel" | "playlist";

export type YoutubeSource = {
    id: string;
    kind: YoutubeSourceKind;
    title: string;
    sourceUrl: string;
    fetchedAt: string;
    videos: YoutubeVideo[];
};

export type YoutubeLibrary = {
    sources: YoutubeSource[];
    selectedId?: string;
};

export type YoutubeFetchProgress = {
    message: string;
};

export type YoutubeFetchResult =
    | { ok: true; library: YoutubeLibrary; warning?: string }
    | { ok: false; error: string };

export type YoutubeSaveResult = { ok: true } | { ok: false; error: string };

export type YoutubeExportResult =
    | { ok: true; path: string }
    | { ok: false; canceled: true }
    | { ok: false; error: string };

export type YoutubeTarget =
    | { kind: "playlist"; playlistId: string }
    | { kind: "channel"; channelId: string }
    | { kind: "channel-page"; pageUrl: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{2,80}$/;
const PUBLISHED = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_SOURCES = 100;
const MAX_VIDEOS = 20000;

export const videoUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

export const extractedDateFromPublished = (published: string): ExtractedDate => {
    const match = PUBLISHED.exec(published);
    if (!match) {
        return {};
    }
    return {
        year: Number.parseInt(match[1], 10),
        month: Number.parseInt(match[2], 10),
        day: Number.parseInt(match[3], 10),
    };
};

export const videoMatchesPeriod = (video: YoutubeVideo, period?: DatePeriod): boolean =>
    dateMatchesPeriod(extractedDateFromPublished(video.published), period);

const isYoutubeHost = (hostname: string): boolean => {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    return host === "youtube.com"
        || host === "www.youtube.com"
        || host === "m.youtube.com"
        || host === "music.youtube.com"
        || host === "www.youtube-nocookie.com"
        || host === "youtube-nocookie.com"
        || host === "youtu.be";
};

const withScheme = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.startsWith("@")) {
        const handle = trimmed.split(/[?\s#]/)[0] ?? trimmed;
        return `https://www.youtube.com/${handle}`;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (/^(www\.|m\.|music\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }
    return trimmed;
};

export const parseYoutubeTarget = (
    input: string,
): { ok: true; target: YoutubeTarget } | { ok: false; error: string } => {
    let url: URL;
    try {
        url = new URL(withScheme(input));
    } catch {
        return { ok: false, error: "Enter a YouTube channel or playlist URL." };
    }
    if (!isYoutubeHost(url.hostname)) {
        return { ok: false, error: "That URL is not on YouTube." };
    }

    const list = url.searchParams.get("list")?.trim() ?? "";
    const path = decodeURIComponent(url.pathname);
    const looksLikePlaylistPath = /\/playlist(?:\/|$)/.test(path)
        || /\/embed\/videoseries/.test(path)
        || path === "/watch"
        || url.hostname.toLowerCase() === "youtu.be";
    if (PLAYLIST_ID.test(list) && (looksLikePlaylistPath || list.startsWith("PL") || list.startsWith("UU") || list.startsWith("OL") || list.startsWith("FL"))) {
        return { ok: true, target: { kind: "playlist", playlistId: list } };
    }

    const channel = path.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/|$)/);
    if (channel?.[1]) {
        return { ok: true, target: { kind: "channel", channelId: channel[1] } };
    }

    const handle = path.match(/^\/(@[^/]+)/);
    if (handle?.[1]) {
        return { ok: true, target: { kind: "channel-page", pageUrl: `https://www.youtube.com/${handle[1]}` } };
    }

    const custom = path.match(/^\/(c|user)\/([^/]+)/i);
    if (custom?.[1] && custom[2]) {
        return {
            ok: true,
            target: { kind: "channel-page", pageUrl: `https://www.youtube.com/${custom[1]}/${custom[2]}` },
        };
    }

    if (path === "/watch" || url.hostname.toLowerCase() === "youtu.be" || /^\/(shorts|live|embed)\//.test(path)) {
        return { ok: false, error: "That is a single video. Paste the channel or playlist URL instead." };
    }
    return { ok: false, error: "Paste a channel URL (youtube.com/@name or /channel/UC…) or a playlist URL." };
};

const videoIdFromUrl = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (VIDEO_ID.test(trimmed)) {
        return trimmed;
    }
    try {
        const url = new URL(trimmed);
        const query = url.searchParams.get("v")?.trim() ?? "";
        if (VIDEO_ID.test(query)) {
            return query;
        }
        const short = url.hostname.toLowerCase() === "youtu.be" ? url.pathname.replace(/^\//, "") : "";
        if (VIDEO_ID.test(short)) {
            return short;
        }
        const shorts = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
        if (shorts?.[1]) {
            return shorts[1];
        }
    } catch {
        return undefined;
    }
    return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return undefined;
};

const cleanPublished = (value: unknown): string => {
    if (typeof value !== "string") {
        return "";
    }
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    return match?.[1] ?? "";
};

const parseVideo = (value: unknown): YoutubeVideo | undefined => {
    const record = asRecord(value);
    if (!record) {
        return undefined;
    }
    const urlValue = typeof record["url"] === "string" ? record["url"] : "";
    const idValue = typeof record["id"] === "string" ? record["id"].trim() : "";
    const id = VIDEO_ID.test(idValue) ? idValue : videoIdFromUrl(urlValue);
    if (!id) {
        return undefined;
    }
    const titleValue = typeof record["title"] === "string" ? record["title"].trim() : "";
    return {
        id,
        title: titleValue || id,
        published: cleanPublished(record["published"]),
        url: videoUrl(id),
    };
};

const parseSource = (value: unknown): YoutubeSource | undefined => {
    const record = asRecord(value);
    if (!record) {
        return undefined;
    }
    const kind = record["kind"];
    if (kind !== "channel" && kind !== "playlist") {
        return undefined;
    }
    const id = typeof record["id"] === "string" ? record["id"].trim() : "";
    const sourceUrl = typeof record["sourceUrl"] === "string" ? record["sourceUrl"].trim() : "";
    if (!id || !sourceUrl) {
        return undefined;
    }
    if (!Array.isArray(record["videos"])) {
        return undefined;
    }
    const videos: YoutubeVideo[] = [];
    const seen = new Set<string>();
    for (const entry of record["videos"]) {
        if (videos.length >= MAX_VIDEOS) {
            break;
        }
        const video = parseVideo(entry);
        if (!video || seen.has(video.id)) {
            continue;
        }
        seen.add(video.id);
        videos.push(video);
    }
    if (videos.length === 0) {
        return undefined;
    }
    const title = typeof record["title"] === "string" && record["title"].trim()
        ? record["title"].trim()
        : sourceUrl;
    const fetchedAt = typeof record["fetchedAt"] === "string" ? record["fetchedAt"] : "";
    return { id, kind, title, sourceUrl, fetchedAt, videos };
};

export const parseYoutubeLibraryJson = (
    text: string,
): { ok: true; library: YoutubeLibrary } | { ok: false; error: string } => {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return { ok: false, error: "That file is not valid JSON." };
    }
    const record = asRecord(raw);
    const sourceList = Array.isArray(raw) ? raw : record?.["sources"];
    if (!Array.isArray(sourceList)) {
        return { ok: false, error: "The file has no YouTube sources to import." };
    }
    if (record && record["version"] !== undefined && record["version"] !== 1) {
        return { ok: false, error: "That library was exported by a newer version of Link Randomizer." };
    }
    const sources: YoutubeSource[] = [];
    for (const entry of sourceList) {
        if (sources.length >= MAX_SOURCES) {
            break;
        }
        const source = parseSource(entry);
        if (source) {
            sources.push(source);
        }
    }
    if (sources.length === 0) {
        return { ok: false, error: "No channel or playlist videos were found in that file." };
    }
    const selectedRaw = typeof record?.["selectedId"] === "string" ? record["selectedId"] : "";
    const selectedId = sources.some((source) => source.id === selectedRaw) ? selectedRaw : sources[0]?.id;
    return selectedId ? { ok: true, library: { sources, selectedId } } : { ok: true, library: { sources } };
};

export const serializeYoutubeLibrary = (library: YoutubeLibrary): string => {
    const payload: { version: 1; sources: YoutubeSource[]; selectedId?: string } = {
        version: 1,
        sources: library.sources,
    };
    if (library.selectedId) {
        payload.selectedId = library.selectedId;
    }
    return JSON.stringify(payload, null, 2);
};

export const mergeYoutubeLibraries = (current: YoutubeLibrary, incoming: YoutubeLibrary): YoutubeLibrary => {
    const incomingIds = new Set(incoming.sources.map((source) => source.id));
    const sources = [
        ...incoming.sources,
        ...current.sources.filter((source) => !incomingIds.has(source.id)),
    ].slice(0, MAX_SOURCES);
    const selectedId = incoming.sources[0]?.id ?? current.selectedId;
    if (selectedId && sources.some((source) => source.id === selectedId)) {
        return { sources, selectedId };
    }
    return { sources };
};

export const emptyYoutubeLibrary = (): YoutubeLibrary => ({ sources: [] });

export const channelIdPattern = CHANNEL_ID;
