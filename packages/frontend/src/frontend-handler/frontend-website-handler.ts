import { WebsiteService } from "@linkrandomizer/common";
import { registerOrCallCallback } from "./frontend-service";

export const FrontendWebsiteHandler: WebsiteService = {
    sendToBackend: {
        analyzeWebsite: (data: { url: string; maxDepth: number; canBeVisitedRegex: string; canBeReturnedRegex: string }): void => {
            console.log("analyzeWebsite", data);
        },
        setActive: (active: boolean): void => {
            console.log("setActive", active);
        }
    },
    invokeFromBackend: {
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
