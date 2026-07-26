import type { Page } from "playwright";

export interface WebsiteController{
    canBeVisited(url:string):boolean;
    canBeReturned(url:string):boolean;
    requireUserAttention(page:Page):Promise<boolean>;
    maxDepth():number;
    initialUrl():string;
    name():string;
    parentDomain():string;
}

export type ExtractedUrls={
    name:string;
    urlsToVisit:Record<string,number|null>;
    urlsToReturn:string[]
}
