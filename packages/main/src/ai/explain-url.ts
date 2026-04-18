import type { Page } from 'playwright';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionAssistantMessageParam, ChatCompletionUserMessageParam, ChatCompletionContentPart } from 'openai/resources/chat/completions';
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import { opennAI_API_KEY } from '../config.js';
import { url } from 'inspector';
import { z } from 'zod';
import { BrowserActionSchema, executeBrowserAction } from '../agent/actions.js';
import { exec } from 'child_process';
import { type ChatHistory, type GeneratedURL, type Message, type Website, WebsiteSchema } from '@linkrandomizer/common';
import type { EasyInputMessage, ResponseCreateParams } from 'openai/resources/responses/responses.mjs';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: opennAI_API_KEY
});

const transformBufferToBase64 = (imageBuffer: ArrayBufferLike): string => {
    return Buffer.from(imageBuffer).toString('base64');

}

export const explainURL = async (
    url: GeneratedURL,
    messages: ChatHistory
): Promise<string> => {
   console.log("Explaining URL with OpenAI. URL:", url, "Messages:", messages);
   const transformMessage=(message:Message):string|ChatCompletionContentPart[]=>{
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
 

    const messagesTransformed: ChatCompletionMessageParam[] = messages.map(msg => {
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
    });
    console.log("Transformed messages for OpenAI:", messagesTransformed);

   
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messagesTransformed,
        max_completion_tokens:16_000,
    });
    console.log("OpenAI response:", response.choices[0]?.message.content);

    return response.choices[0]?.message.content || "";





};

