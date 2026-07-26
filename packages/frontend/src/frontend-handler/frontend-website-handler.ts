import { RegexWebsiteControllerDefinition, WebsiteService } from "@linkrandomizer/common";
import { registerOrCallCallback } from "./frontend-service";

export const FrontendWebsiteHandler: WebsiteService = {
    sendToBackend: {
        analyzeWebsite: (data: { controllerNames: string[]; openFilePicker?: boolean }): void => {
            console.log("analyzeWebsite", data);
        },
        setActive: (active: boolean): void => {
            console.log("setActive", active);
        }
    },
    invokeFromBackend: {
        listControllerDefinitions: async (): Promise<RegexWebsiteControllerDefinition[]> => {
            return [];
        },
        saveControllerDefinition: async (
            def: RegexWebsiteControllerDefinition,
        ): Promise<{ ok: true; jsonPath: string; jsPath: string } | { ok: false; error: string }> => {
            console.log("saveControllerDefinition", def);
            return { ok: false, error: "Not available outside Electron" };
        },
        loadControllerDefinition: async (
            _data: { name: string },
        ): Promise<RegexWebsiteControllerDefinition | null> => {
            return null;
        },
    },
    eventFromBackend: {
        randomUrlsGenerated: (urls: string[], callback?: (urls: string[]) => void): void => {
            registerOrCallCallback("randomUrlsGenerated", callback, urls);
        },
        webSiteAnalysisStateChanged: (status: number, callback?: (status: number) => void): void => {
            console.log("websiteAnalysisStatus", status);
            registerOrCallCallback("webSiteAnalysisStateChanged", callback, status);
        },
        webSiteAnalysisFinished: (callback?: () => void): void => {
            registerOrCallCallback("webSiteAnalysisFinished", callback);
        }
    }
};
