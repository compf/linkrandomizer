import type { AnnotationService, UrlAnnotationStore } from "@linkrandomizer/common";
import { pruneAnnotationStore } from "@linkrandomizer/common";

const STORAGE_KEY = "linkrandomizer.urlAnnotations";

const readLocal = (): UrlAnnotationStore => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw) as UrlAnnotationStore;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

export const FrontendAnnotationHandler: AnnotationService = {
    sendToBackend: {},
    invokeFromBackend: {
        loadUrlAnnotations: async (): Promise<UrlAnnotationStore> => readLocal(),
        saveUrlAnnotations: async (
            data: UrlAnnotationStore,
        ): Promise<{ ok: true } | { ok: false; error: string }> => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneAnnotationStore(data ?? {})));
                return { ok: true };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { ok: false, error: message };
            }
        },
    },
    eventFromBackend: {},
};
