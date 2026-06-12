import { ChatCompletionMessageParam } from "openai/resources/chat/completions/index.js";
import { post } from "./ai-agent.js";

export type RankScriptTarget = "url" | "website" | "both";

const stripCodeFence = (content: string): string => {
    const fenced = content.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        return fenced[1].trim();
    }
    return content.trim();
};

export const generateRankScript = async (
    preferences: string,
    target: RankScriptTarget
): Promise<string> => {
    const functionRequirement =
        target === "url"
            ? "Implement function rankUrl(url) only."
            : target === "website"
              ? "Implement function rankWebsite(website) only."
              : "Implement both rankUrl(url) and rankWebsite(website).";

    const messages: ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: `You write JavaScript ranking functions for a URL randomizer.

GeneratedURL shape:
{ url: string, variables: Record<string, unknown>, website: Website }

Website shape:
{ name: string, tags: string[], schema: unknown[], variables: unknown[], downloadType: string }

Rules:
- ${functionRequirement}
- Return only JavaScript source code, no markdown fences.
- Higher numeric scores mean higher priority.
- Do not use import, require, fetch, eval, or DOM APIs.
- Always return finite numbers.
- URL date variables are often named year, month, day (sometimes with suffixes like year1).`,
        },
        {
            role: "user",
            content: `Ranking preferences:\n${preferences}`,
        },
    ];

    const response = await post(messages);
    return stripCodeFence(response);
};
