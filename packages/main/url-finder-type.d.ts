import type { Page } from "playwright";

export interface WebsiteController{
    canBeVisited(url:string):boolean;
    canBeReturned(url:string):boolean;
    requireUserAttention(page:Page):Promise<boolean>;
    maxDepth():number;
    initialUrl():string;
    name():string;
    parentDomain():string;
    /** Optional sitemap.xml URL harvested before page crawling. */
    sitemapUrl?():string|undefined;
    /** Optional RSS/Atom feed URL harvested before page crawling. */
    feedUrl?():string|undefined;
}

export type ExtractedUrls={
    name:string;
    urlsToVisit:Record<string,number|null>;
    urlsToReturn:string[]
}
