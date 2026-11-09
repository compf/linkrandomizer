import type {
  YoutubeExportResult,
  YoutubeFetchProgress,
  YoutubeFetchResult,
  YoutubeLibrary,
  YoutubeSaveResult,
  YoutubeService,
} from "@linkrandomizer/common";
import { emptyYoutubeLibrary, parseYoutubeLibraryJson, serializeYoutubeLibrary } from "@linkrandomizer/common";
import { registerOrCallCallback } from "./frontend-service";

const STORAGE_KEY = "linkrandomizer.youtubeLibrary";

const readLocal = (): YoutubeLibrary => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyYoutubeLibrary();
    }
    const parsed = parseYoutubeLibraryJson(raw);
    return parsed.ok ? parsed.library : emptyYoutubeLibrary();
  } catch {
    return emptyYoutubeLibrary();
  }
};

const downloadJson = (json: string): void => {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "youtube-library.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const FrontendYoutubeHandler: YoutubeService = {
  sendToBackend: {},
  invokeFromBackend: {
    loadYoutubeLibrary: async (): Promise<YoutubeLibrary> => readLocal(),
    saveYoutubeLibrary: async (library: YoutubeLibrary): Promise<YoutubeSaveResult> => {
      try {
        const sources = Array.isArray(library?.sources) ? library.sources : [];
        const selectedId = typeof library?.selectedId === "string" ? library.selectedId : "";
        const next = selectedId ? { sources, selectedId } : { sources };
        localStorage.setItem(STORAGE_KEY, serializeYoutubeLibrary(next));
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          error: message.includes("Quota")
            ? "The browser storage is full, so this library could not be saved."
            : message,
        };
      }
    },
    fetchYoutubeSource: async (): Promise<YoutubeFetchResult> => ({
      ok: false,
      error: "Downloading a YouTube catalog needs the desktop app. Import a library exported from Electron.",
    }),
    exportYoutubeLibrary: async (data: { json: string }): Promise<YoutubeExportResult> => {
      try {
        downloadJson(data?.json ?? serializeYoutubeLibrary(emptyYoutubeLibrary()));
        return { ok: true, path: "youtube-library.json" };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message };
      }
    },
  },
  eventFromBackend: {
    youtubeFetchProgress: (data?: YoutubeFetchProgress, callback?: (progress: YoutubeFetchProgress) => void): void => {
      registerOrCallCallback("youtubeFetchProgress", callback, data);
    },
  },
};
