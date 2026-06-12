import { AiRankerConfig, DateProximityConfig, ItemRanker, RankerName, TagRankerConfig } from "./item-ranker.js";
import { alphabeticalRanker } from "./alphabetical-ranker.js";
import { createAiRanker } from "./ai-ranker.js";
import { createDateProximityRanker } from "./date-proximity-ranker.js";
import { dailyRandomRanker } from "./daily-random-ranker.js";
import { noRanking } from "./no-ranking.js";
import { createTagRanker } from "./tag-ranker.js";

export const defaultDateProximityConfig = (): DateProximityConfig => ({
    targetYear: new Date().getFullYear() - 30,
    targetMonth: 1,
});

export const defaultTagRankerConfig = (tags: string[]): TagRankerConfig => ({
    tagPriority: [...tags],
});

export const defaultAiRankerConfig = (): AiRankerConfig => ({
    script: "",
    target: "both",
});

export const staticRankers: Record<"No ranking" | "Daily random" | "Alphabetical", ItemRanker> = {
    "No ranking": noRanking,
    "Daily random": dailyRandomRanker,
    Alphabetical: alphabeticalRanker,
};

export const rankerNames: RankerName[] = [
    "No ranking",
    "Date proximity",
    "Daily random",
    "By tag priority",
    "AI custom",
    "Alphabetical",
];

export const createRanker = (
    name: RankerName,
    options?: {
        dateProximity?: DateProximityConfig;
        tagPriority?: TagRankerConfig;
        ai?: AiRankerConfig;
    }
): ItemRanker => {
    switch (name) {
        case "No ranking":
            return staticRankers["No ranking"];
        case "Daily random":
            return staticRankers["Daily random"];
        case "Alphabetical":
            return staticRankers.Alphabetical;
        case "Date proximity":
            return createDateProximityRanker(options?.dateProximity ?? defaultDateProximityConfig());
        case "By tag priority":
            return createTagRanker(options?.tagPriority ?? { tagPriority: [] });
        case "AI custom":
            return createAiRanker(options?.ai ?? defaultAiRankerConfig());
    }
};
