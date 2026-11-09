import type { YoutubeExportResult, YoutubeFetchProgress, YoutubeFetchResult, YoutubeLibrary, YoutubeSaveResult } from "../models/youtube.js";
import { unsupported } from "./abstract-service.js";

export const YoutubeServiceSchema = {
    sendToBackend: {},
    invokeFromBackend: {
        loadYoutubeLibrary: (): Promise<YoutubeLibrary> => unsupported() as never,
        saveYoutubeLibrary: (library: YoutubeLibrary): Promise<YoutubeSaveResult> => unsupported() as never,
        fetchYoutubeSource: (data: { url: string }): Promise<YoutubeFetchResult> => unsupported() as never,
        exportYoutubeLibrary: (data: { json: string }): Promise<YoutubeExportResult> => unsupported() as never,
    },
    eventFromBackend: {
        youtubeFetchProgress: (
            data?: YoutubeFetchProgress,
            callback?: (data: YoutubeFetchProgress) => void,
        ): void => unsupported(),
    },
};

export type YoutubeService = typeof YoutubeServiceSchema;
