import { GeneratedURL } from "../models/generated_url.js";
import { Website } from "../models/website_schemas.js";
import { ItemRanker, RankerName } from "./item-ranker.js";
import { dailySeed, seededUnitRandom } from "./ranker-utils.js";

export class DailyRandomRanker implements ItemRanker {
    getName(): RankerName {
        return "Daily random";
    }

    rankWebsite(website: Website): number {
        return seededUnitRandom(dailySeed(website.schema[0] as string)) * 1_000_000;
    }

    rankUrl(url: GeneratedURL): number {
        return seededUnitRandom(dailySeed(url.website.schema[0] as string, new Date()) ^ dailySeed(url.url)) * 1_000_000;
    }
}

export const dailyRandomRanker = new DailyRandomRanker();
