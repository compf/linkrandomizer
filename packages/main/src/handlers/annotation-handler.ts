import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { AnnotationService, UrlAnnotationStore } from "@linkrandomizer/common";
import { pruneAnnotationStore } from "@linkrandomizer/common";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANNOTATIONS_PATH = path.resolve(
    __dirname,
    "../../../common/src/models/data/url-annotations.json",
);

const readAnnotations = (): UrlAnnotationStore => {
    try {
        if (!fs.existsSync(ANNOTATIONS_PATH)) {
            return {};
        }
        const raw = fs.readFileSync(ANNOTATIONS_PATH, "utf8");
        const parsed = JSON.parse(raw) as UrlAnnotationStore;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
        console.error("Failed to load URL annotations:", error);
        return {};
    }
};

const writeAnnotations = (data: UrlAnnotationStore): void => {
    fs.mkdirSync(path.dirname(ANNOTATIONS_PATH), { recursive: true });
    fs.writeFileSync(ANNOTATIONS_PATH, JSON.stringify(pruneAnnotationStore(data), null, 2) + "\n", "utf8");
};

export const AnnotationHandler: AnnotationService = {
    sendToBackend: {},
    invokeFromBackend: {
        loadUrlAnnotations: async (): Promise<UrlAnnotationStore> => readAnnotations(),
        saveUrlAnnotations: async (
            data: UrlAnnotationStore,
        ): Promise<{ ok: true } | { ok: false; error: string }> => {
            try {
                writeAnnotations(data ?? {});
                return { ok: true };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { ok: false, error: message };
            }
        },
    },
    eventFromBackend: {},
};
