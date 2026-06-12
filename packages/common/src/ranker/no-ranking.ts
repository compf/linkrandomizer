import { ItemRanker, RankerName } from "./item-ranker.js";

export class NoRanking implements ItemRanker {
    getName(): RankerName {
        return "No ranking";
    }
}

export const noRanking = new NoRanking();
