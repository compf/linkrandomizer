import { GeneratedURL } from "../models/generated_url.js";
import { Website } from "../models/website_schemas.js";
import { ItemRanker, RankerName, TagRankerConfig } from "./item-ranker.js";
import { tagPriorityScore } from "./ranker-utils.js";

export class TagRanker implements ItemRanker {
    constructor(private readonly config: TagRankerConfig) {}

    getName(): RankerName {
        return "By tag priority";
    }

    rankWebsite(website: Website): number {
        return tagPriorityScore(website.tags, this.config.tagPriority);
    }

    rankUrl(url: GeneratedURL): number {
        return tagPriorityScore(url.website.tags, this.config.tagPriority);
    }
}

export const createTagRanker = (config: TagRankerConfig): ItemRanker => new TagRanker(config);
