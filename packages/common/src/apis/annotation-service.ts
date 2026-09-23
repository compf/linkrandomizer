import { unsupported } from "./abstract-service.js";
import type { UrlAnnotationStore } from "../models/url-annotation.js";

export const AnnotationServiceSchema = {
    sendToBackend: {},
    invokeFromBackend: {
        loadUrlAnnotations: (): Promise<UrlAnnotationStore> => unsupported() as never,
        saveUrlAnnotations: (
            data: UrlAnnotationStore,
        ): Promise<{ ok: true } | { ok: false; error: string }> => unsupported() as never,
    },
    eventFromBackend: {},
};

export type AnnotationService = typeof AnnotationServiceSchema;
