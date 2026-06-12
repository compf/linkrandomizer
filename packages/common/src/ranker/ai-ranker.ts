import { GeneratedURL } from "../models/generated_url.js";
import { Website } from "../models/website_schemas.js";
import { AiRankerConfig, ItemRanker, RankerName } from "./item-ranker.js";
import { executeRankScript, sanitizeRankScore } from "./ranker-utils.js";

export class AiRanker implements ItemRanker {
    private readonly rankUrlFn?: (url: GeneratedURL) => number;
    private readonly rankWebsiteFn?: (website: Website) => number;

    constructor(private readonly config: AiRankerConfig) {
        const compiled = executeRankScript(config.script);
        if (config.target === "url" || config.target === "both") {
            this.rankUrlFn = compiled.rankUrl;
        }
        if (config.target === "website" || config.target === "both") {
            this.rankWebsiteFn = compiled.rankWebsite;
        }
    }

    getName(): RankerName {
        return "AI custom";
    }

    rankUrl(url: GeneratedURL): number {
        if (!this.rankUrlFn) {
            return 0;
        }
        return sanitizeRankScore(this.rankUrlFn(url));
    }

    rankWebsite(website: Website): number {
        if (!this.rankWebsiteFn) {
            return 0;
        }
        return sanitizeRankScore(this.rankWebsiteFn(website));
    }
}

export const createAiRanker = (config: AiRankerConfig): ItemRanker => new AiRanker(config);
