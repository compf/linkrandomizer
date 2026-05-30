export interface WebsiteController{
    canBeVisited(url:string):boolean;
    canBeReturned(url:string):boolean;
    requireUserAttention(page:Page):Promise<boolean>;
    maxDepth():number;
    initialUrl():string;
}

export type ExtractedUrls={
    name:string;
    prefixToUrls:Record<string,string[]>;
}