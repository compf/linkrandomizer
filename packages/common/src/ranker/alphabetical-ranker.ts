import { GeneratedURL } from "../models/generated_url.js";
import { Website } from "../models/website_schemas.js";
import { ItemRanker, RankerName } from "./item-ranker.js";

const alphabeticalScore = (value: string): number => {
    let score = 0;
    const normalized = value.toLowerCase();
    for (let i = 0; i < normalized.length; i++) {
        score = score * 256 + (255 - normalized.charCodeAt(i));
    }
    return score;
};

export class AlphabeticalRanker implements ItemRanker {
    getName(): RankerName {
        return "Alphabetical";
    }

    rankWebsite(website: Website): number {
        return alphabeticalScore(website.schema[0] as string);
    }

    rankUrl(url: GeneratedURL): number {
        return alphabeticalScore(url.website.schema[0] as string) * 1_000_000 + alphabeticalScore(url.url);
    }
}

export const alphabeticalRanker = new AlphabeticalRanker();
