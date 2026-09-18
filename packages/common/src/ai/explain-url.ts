import { ChatCompletionAssistantMessageParam, ChatCompletionContentPart, ChatCompletionMessageParam, ChatCompletionUserMessageParam } from "openai/resources";
import { ChatHistory, ChatMessage } from "../apis/url-service.js";
import { GeneratedURL } from "../models/generated_url.js";
import { post } from "./ai-agent.js";
import { briefingRequestForUrl, describeGeneratedUrl, getPeriodBriefing } from "./period-briefing.js";

const transformBufferToBase64 = (imageBuffer: ArrayBufferLike): string => {
    
        var binary = '';
        var bytes = new Uint8Array( imageBuffer );
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode( bytes[ i ] );
        }
        return window.btoa( binary );
    

}

const transformMessage=(message:ChatMessage):string|ChatCompletionContentPart[]=>{
    if(message.type==="text"){
       return message.text ??""
    }
    else if(message.type==="image"){
        return [
            {
                type:"image_url",
                image_url:{
                    url:message.image ? `data:image/png;base64,${transformBufferToBase64(message.image)}` : ""
                }
            }
        ]
       
    }
    else if(message.type==="file"){
        return[
            {
                type:"file",

                file:{
                    filename:"file",
                    file_data:"data:application/pdf;base64,"+transformBufferToBase64(message.file?.data || new ArrayBuffer(0))


                }
            }
        ]
    }
    return ""
}

export const URL_BRIEF_PROMPT =
    "What important events in this month and year is this page likely to address? Summarize what a reader would expect to find at this URL, using the date and site context. Do not ask me to paste the page unless necessary.";

export const explainURL = async (
    url: GeneratedURL,
    messages: ChatHistory,
    extras?: { periodBriefing?: string },
): Promise<string> => {
   console.log("Explaining URL with OpenAI. URL:", url, "Messages:", messages);

    let periodBriefing = extras?.periodBriefing;
    if (!periodBriefing) {
        const request = briefingRequestForUrl(url);
        if (request) {
            try {
                periodBriefing = await getPeriodBriefing(request);
            } catch (error) {
                console.error("Failed to load period briefing:", error);
            }
        }
    }

    const systemParts = [
        "You help a user decide whether to open an archive URL.",
        describeGeneratedUrl(url),
        url.website.prompt ? `Site-specific analysis instructions:\n${url.website.prompt.trim()}` : undefined,
        periodBriefing ? `Known events in this period:\n${periodBriefing}` : undefined,
        "Use the URL, date, and site context even if the user has not attached page content.",
    ].filter(Boolean);

    const messagesTransformed: ChatCompletionMessageParam[] = [
        { role: "system", content: systemParts.join("\n\n") },
        ...messages.map(msg => {
        if (msg.sender === "assistant") {
            return {
                role: "assistant",
                content: msg.content.type === "text" ? (msg.content.text || "") : "[image]"
            } as ChatCompletionAssistantMessageParam;
        } else {
            return {
                role: "user",
                content: transformMessage(msg.content)
                
            } as ChatCompletionUserMessageParam;
        }
    })];
    console.log("Transformed messages for OpenAI:", messagesTransformed);

   try{
    const response = await post(messagesTransformed, { model: "gpt-4o", maxCompletionTokens: 2_000 });
    return response;
   }catch(error){
    return "Error explaining URL:"+(error instanceof Error ? error.message : String(error));
   }
};
