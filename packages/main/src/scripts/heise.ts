import type { Page } from "playwright";
import type { WebsiteController } from "../../url-finder-type.js";

 export const HeiseController: WebsiteController = {
    canBeVisited: (url: string) => {
        const isRightForm= url.match(/newsticker\/archiv\/\d\d\d\d\/\d\d\/$/) !== null;
        if(isRightForm){
            const splitUrl=url.split("/");
            const year=parseInt(splitUrl[5] ?? "0");
            const month=parseInt(splitUrl[6] ?? "0");
           const currentDate=new Date();
           if(year<currentDate.getFullYear() || (year===currentDate.getFullYear() && month<=currentDate.getMonth()+1)){
            return true;
           }
        }
        return false;
    },
    canBeReturned: (url: string) => {
        return url.includes("/news/");
    },
    requireUserAttention: async (page: Page) => {
        return  false
    },
    maxDepth: () => {
        return 3;
    },
    initialUrl: () => {
        return "https://www.heise.de/newsticker/archiv/2026/05/";
    },
    name: () => {
        return "heise";
    },
    parentDomain: () => {
        return "https://www.heise.de";
    }
}