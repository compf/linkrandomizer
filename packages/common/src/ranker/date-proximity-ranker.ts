import { GeneratedURL } from "../models/generated_url.js";
import { DateProximityConfig, ItemRanker, RankerName } from "./item-ranker.js";
import { dateProximityScore } from "./ranker-utils.js";

export class DateProximityRanker implements ItemRanker {
    constructor(private readonly config: DateProximityConfig) {}

    getName(): RankerName {
        return "Date proximity";
    }

    rankUrl(url: GeneratedURL): number {
        return dateProximityScore(url, this.config.targetYear, this.config.targetMonth);
    }
}

export const createDateProximityRanker = (config: DateProximityConfig): ItemRanker =>
    new DateProximityRanker(config);
