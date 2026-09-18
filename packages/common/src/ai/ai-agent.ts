import { ChatCompletionMessageParam } from "openai/resources/chat/completions/index.js"

export type PostOptions = {
    model?: string;
    maxCompletionTokens?: number;
}

export const post=async(
    messages:ChatCompletionMessageParam[],
    options: PostOptions = {},
):Promise<string>=>{
    const body={
        model: options.model ?? "gpt-4o",
        messages:messages,
        max_completion_tokens: options.maxCompletionTokens ?? 2_000,
    }
    const key=await (window as any).api.invokeFromBackend.getKey();
    const response=await fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Bearer "+key
        },
        body:JSON.stringify(body)
    })
    let data: { choices?: { message?: { content?: string } }[]; error?: { message?: string } } = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }
    console.log("OpenAI response:", data);
    if (!response.ok) {
        const detail = typeof data.error?.message === "string" ? data.error.message : response.statusText;
        return `AI request failed (${response.status}): ${detail || "no response body"}`;
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.length > 0) {
        return content;
    }
    return "AI returned an empty response. Check that an API key is configured.";
}
