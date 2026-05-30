import type { Page } from "playwright";
import type { WebsiteController } from "../../url-finder-type.js";

 export const HeiseController: WebsiteController = {
    canBeVisited: (url: string) => {
        return url.includes("newsticker/archiv/")
    },
    canBeReturned: (url: string) => {
        return url.includes("/news/");
    },
    requireUserAttention: async (page: Page) => {
        return await page.isVisible('xpath=//button[text()="Zustimmen"]');
    },
    maxDepth: () => {
        return 3;
    },
    initialUrl: () => {
        return "https://www.heise.de/newsticker/archiv/";
    }
}