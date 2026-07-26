import { GeneratedURL } from "../models/generated_url.js";
import { Website } from "../models/website_schemas.js";
import { unsupported } from "./abstract-service.js"



export const WebsiteServiceSchema = {
    sendToBackend: {
        analyzeWebsite: (data: { url: string; maxDepth: number; canBeVisitedRegex: string; canBeReturnedRegex: string }): void => unsupported(),
        setActive: (active: boolean): void => unsupported(),
    },

    invokeFromBackend: {
    },

    eventFromBackend: {
        randomUrlsGenerated: (urls: string[], callback?: (urls: string[]) => void): void => unsupported(),
        webSiteAnalysisStateChanged: (state: number, callback?: (state: number) => void): void => unsupported(),
        webSiteAnalysisFinished: (callback?: () => void): void => unsupported(),
    }
}

export type WebsiteService = typeof WebsiteServiceSchema