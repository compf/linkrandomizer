import { ControllerAssistRequest, ControllerAssistResult, InducedSchemaRecord, InduceSchemaResult, RegexWebsiteControllerDefinition, WebsiteService } from "@linkrandomizer/common";
import { registerOrCallCallback } from "./frontend-service";

export const FrontendWebsiteHandler: WebsiteService = {
    sendToBackend: {
        analyzeWebsite: (data: { controllerNames: string[]; openFilePicker?: boolean }): void => {
            console.log("analyzeWebsite", data);
        },
        setActive: (active: boolean): void => {
            console.log("setActive", active);
        },
        harvestSite: (data: { site: string }): void => {
            console.log("harvestSite (unavailable outside Electron)", data);
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
        listCrawledSites: async (): Promise<{ name: string; urlCount: number }[]> => {
            return [];
        },
        induceSchema: async (_data: { site: string }): Promise<InduceSchemaResult> => {
            return { ok: false, error: "Schema induction needs the desktop app." };
        },
        proposeController: async (_data: ControllerAssistRequest): Promise<ControllerAssistResult> => {
            return { ok: false, error: "The controller assistant needs the desktop app." };
        },
        // The web build reads the snapshot the Electron app exports next to the URL pools.
        listInducedSchemas: async (): Promise<InducedSchemaRecord[]> => {
            try {
                const response = await fetch("extracted-urls/induced-schemas.json");
                if (!response.ok) {
                    return [];
                }
                const parsed = (await response.json()) as InducedSchemaRecord[];
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
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
