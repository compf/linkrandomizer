import { GeneratedURL } from "../models/generated_url.js";
import { Website } from "../models/website_schemas.js";
import { unsupported } from "./abstract-service.js"



export const WebsiteServiceSchema = {
    sendToBackend: {
        analyzeWebsite: (data: { url: string; existingLinks: string[] }): void => unsupported(),
    },

    invokeFromBackend: {
        getAvailableWebsites: (): Promise<Website[]> => unsupported(),
        saveWebsites: (): Promise<void> => unsupported()
    },

    eventFromBackend: {
        randomUrlsGenerated: (urls: string[], callback?: (urls: string[]) => void): void => unsupported(),
        websiteAnalysisComplete: (schemas: Website[], callback?: (schemas: Website[]) => void): void => unsupported(),
        websiteAnalysisStatus: (status: string, callback?: (status: string) => void): void => unsupported()
    }
}

export type WebsiteService = typeof WebsiteServiceSchema