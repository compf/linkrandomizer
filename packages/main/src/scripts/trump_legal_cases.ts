import type { Page } from "playwright";
import type { WebsiteController } from "../../url-finder-type.js";

export const TrumpLegalCasesController: WebsiteController = {
    canBeVisited: (url: string) => {
        return url.includes("courtlistener") && !url.endsWith("pdf");
    },
    canBeReturned: (url: string) => {
        return url.endsWith(".pdf");
    },
    requireUserAttention: async (page: Page) => {
        return false;
    },
    maxDepth: () => {
        return 2;
    },
    initialUrl: () => {
        return "https://www.justsecurity.org/107087/tracker-litigation-legal-challenges-trump-administration/";
    },
    name: () => {
        return "trump_legal_cases";
    },
    parentDomain: () => {
        return "https://www.courtlistener.com";
    }
}