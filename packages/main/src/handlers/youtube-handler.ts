import { app, dialog } from "electron";
import fs from "fs";
import path from "path";
import {
    type YoutubeFetchResult,
    type YoutubeLibrary,
    type YoutubeService,
    emptyYoutubeLibrary,
    parseYoutubeLibraryJson,
    serializeYoutubeLibrary,
} from "@linkrandomizer/common";
import { sendToControlWindow } from "../mainBackend.js";
import { YoutubeFetchError, fetchYoutubeCatalog } from "../youtube/fetch-catalog.js";

const libraryPath = (): string => path.join(app.getPath("userData"), "youtube-library.json");

const readLibrary = (): YoutubeLibrary => {
    try {
        const file = libraryPath();
        if (!fs.existsSync(file)) {
            return emptyYoutubeLibrary();
        }
        const parsed = parseYoutubeLibraryJson(fs.readFileSync(file, "utf8"));
        return parsed.ok ? parsed.library : emptyYoutubeLibrary();
    } catch (error) {
        console.error("Failed to load YouTube library:", error);
        return emptyYoutubeLibrary();
    }
};

const writeLibrary = (library: YoutubeLibrary): void => {
    const file = libraryPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, serializeYoutubeLibrary(library), "utf8");
};

const upsert = (library: YoutubeLibrary, source: YoutubeLibrary["sources"][number]): YoutubeLibrary => {
    const sources = [source, ...library.sources.filter((entry) => entry.id !== source.id)];
    return { sources, selectedId: source.id };
};

export const YoutubeHandler: YoutubeService = {
    sendToBackend: {},
    invokeFromBackend: {
        loadYoutubeLibrary: async (): Promise<YoutubeLibrary> => readLibrary(),
        saveYoutubeLibrary: async (library: YoutubeLibrary) => {
            try {
                const sources = Array.isArray(library?.sources) ? library.sources : [];
                const selectedId = typeof library?.selectedId === "string" ? library.selectedId : "";
                writeLibrary(selectedId ? { sources, selectedId } : { sources });
                return { ok: true as const };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { ok: false as const, error: message };
            }
        },
        fetchYoutubeSource: async (data: { url: string }): Promise<YoutubeFetchResult> => {
            try {
                const loaded = await fetchYoutubeCatalog(data?.url ?? "", (progress) => {
                    YoutubeHandler.eventFromBackend.youtubeFetchProgress(progress);
                });
                const library = upsert(readLibrary(), loaded.source);
                writeLibrary(library);
                return loaded.warning
                    ? { ok: true, library, warning: loaded.warning }
                    : { ok: true, library };
            } catch (error) {
                const message = error instanceof YoutubeFetchError
                    ? error.message
                    : error instanceof Error
                        ? error.message
                        : String(error);
                return { ok: false, error: message };
            }
        },
        exportYoutubeLibrary: async (data: { json: string }) => {
            try {
                const result = await dialog.showSaveDialog({
                    defaultPath: "youtube-library.json",
                    filters: [{ name: "JSON", extensions: ["json"] }],
                });
                if (result.canceled || !result.filePath) {
                    return { ok: false as const, canceled: true as const };
                }
                fs.writeFileSync(result.filePath, data?.json ?? "", "utf8");
                return { ok: true as const, path: result.filePath };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { ok: false as const, error: message };
            }
        },
    },
    eventFromBackend: {
        youtubeFetchProgress: (progress): void => {
            sendToControlWindow("youtubeFetchProgress", progress);
        },
    },
};
