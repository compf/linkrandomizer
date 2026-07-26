import { RegexWebsiteControllerDefinition } from "../models/regex-website-controller.js";
import { unsupported } from "./abstract-service.js";

export const WebsiteServiceSchema = {
    sendToBackend: {
        analyzeWebsite: (data: { controllerNames: string[]; openFilePicker?: boolean }): void => unsupported(),
        setActive: (active: boolean): void => unsupported(),
    },

    invokeFromBackend: {
        listControllerDefinitions: (): Promise<RegexWebsiteControllerDefinition[]> => unsupported() as never,
        saveControllerDefinition: (
            def: RegexWebsiteControllerDefinition,
        ): Promise<{ ok: true; jsonPath: string; jsPath: string } | { ok: false; error: string }> =>
            unsupported() as never,
        loadControllerDefinition: (
            data: { name: string },
        ): Promise<RegexWebsiteControllerDefinition | null> => unsupported() as never,
    },

    eventFromBackend: {
        randomUrlsGenerated: (urls: string[], callback?: (urls: string[]) => void): void => unsupported(),
        webSiteAnalysisStateChanged: (state: number, callback?: (state: number) => void): void => unsupported(),
        webSiteAnalysisFinished: (callback?: () => void): void => unsupported(),
    },
};

export type WebsiteService = typeof WebsiteServiceSchema;
