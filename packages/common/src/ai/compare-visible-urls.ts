import { post } from "./ai-agent.js";
import { describeGeneratedUrl } from "./period-briefing.js";
import type { GeneratedURL } from "../models/generated_url.js";
import type { UrlAnnotation } from "../models/url-annotation.js";

export type VisibleUrlItem = {
    siteName: string;
    generated: GeneratedURL;
    annotation?: UrlAnnotation;
};

export const compareVisibleUrls = async (
    items: VisibleUrlItem[],
    periodLabel?: string,
): Promise<string> => {
    if (items.length === 0) {
        return "There are no visible URLs to compare.";
    }

    const list = items.map((item, index) => {
        const notes = item.annotation?.notes.trim() || undefined;
        const tags = item.annotation?.tags.length ? item.annotation.tags.join(", ") : undefined;
        return [
            `${index + 1}. ${item.siteName}`,
            describeGeneratedUrl(item.generated),
            tags ? `User tags: ${tags}` : undefined,
            notes ? `User notes: ${notes}` : undefined,
        ].filter(Boolean).join("\n");
    }).join("\n\n");

    return post(
        [
            {
                role: "system",
                content: `You help a reader decide which archive URLs are worth opening. Be comparative and specific. Use markdown. Do not invent page contents you cannot infer from the date, site, URL, and user notes.`,
            },
            {
                role: "user",
                content: `Period filter: ${periodLabel ?? "Any time"}

These URLs are currently visible:

${list}

Give a more detailed breakdown of every URL: likely topics, why it might matter, and any overlap. Then recommend a short reading order with reasons. If user notes or tags exist, take them into account.`,
            },
        ],
        { model: "gpt-4o", maxCompletionTokens: 3_000 },
    );
};
