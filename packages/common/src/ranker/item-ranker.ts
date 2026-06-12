import { GeneratedURL } from "../models/generated_url.js";
import { Website } from "../models/website_schemas.js";

export type RankerName =
    | "No ranking"
    | "Date proximity"
    | "Daily random"
    | "By tag priority"
    | "AI custom"
    | "Alphabetical";

export interface ItemRanker {
    getName(): RankerName;
    rankWebsite?(website: Website): number;
    rankUrl?(url: GeneratedURL): number;
}

export type DateProximityConfig = {
    targetYear: number;
    targetMonth?: number;
};

export type TagRankerConfig = {
    tagPriority: string[];
};

export type AiRankerConfig = {
    script: string;
    target: "url" | "website" | "both";
};
