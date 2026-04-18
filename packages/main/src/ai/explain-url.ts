import type { Page } from 'playwright';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionAssistantMessageParam, ChatCompletionUserMessageParam } from 'openai/resources/chat/completions';
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import { opennAI_API_KEY } from '../config.js';
import { url } from 'inspector';
import { z } from 'zod';
import { BrowserActionSchema, executeBrowserAction } from '../agent/actions.js';
import { exec } from 'child_process';
import { type ChatHistory, type GeneratedURL, type Website, WebsiteSchema } from '@linkrandomizer/common';
import type { EasyInputMessage, ResponseCreateParams } from 'openai/resources/responses/responses.mjs';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: opennAI_API_KEY
});

const transformImageToBase64 = (imageBuffer: ArrayBufferLike): string => {
    return Buffer.from(imageBuffer).toString('base64');

}

export const explainURL = async (
    url: GeneratedURL,
    messages: ChatHistory
): Promise<string> => {
   console.log("Explaining URL with OpenAI. URL:", url, "Messages:", messages);

    const messagesTransformed: ChatCompletionMessageParam[] = messages.map(msg => {
        if (msg.sender === "assistant") {
            return {
                role: "assistant",
                content: msg.content.type === "text" ? (msg.content.text || "") : "[image]"
            } as ChatCompletionAssistantMessageParam;
        } else {
            return {
                role: "user",
                content: msg.content.type === "text" ? (msg.content.text || "") : [{
                    type: "image_url",
                    image_url: {
                        url: msg.content.image ? `data:image/png;base64,${transformImageToBase64(msg.content.image)}` : ""
                    }
                }]
            } as ChatCompletionUserMessageParam;
        }
    });

   
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messagesTransformed,
    });

    return response.choices[0]?.message.content || "";





};

