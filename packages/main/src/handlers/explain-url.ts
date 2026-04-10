import type { Page } from 'playwright';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import { normalizeWebsite, getHeuristicWebsiteFromLinks } from './validation.js';
import { opennAI_API_KEY } from '../config.js';
import { url } from 'inspector';
import { z } from 'zod';
import { BrowserActionSchema, executeBrowserAction } from './actions.js';
import { exec } from 'child_process';
import { type GeneratedURL, type Website, WebsiteSchema } from '@linkrandomizer/common';
import type { EasyInputMessage, ResponseCreateParams } from 'openai/resources/responses/responses.mjs';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: opennAI_API_KEY
});


export const explainURL = async (
    url: GeneratedURL,
    messages: { text: string, sender: "user" | "assistant" }[]
): Promise<string> => {
   console.log("Explaining URL with OpenAI. URL:", url, "Messages:", messages);

    const messagesTransformed:any = messages.map(m => ({
        role: m.sender,
        content: [
            {
                type: m.sender === "user" ? "input_text" : "output_text",
                text: m.text
            }
        ]




    }));
    messagesTransformed.push({
        role: "user",
        content: [
            {
                type: "input_file",
               file_url: url.url
            }
        ]

    });



    const response = await openai.responses.create({
        model: "gpt-5",
        reasoning: { effort: "medium" },
        stream: false,
        input: messagesTransformed,
    });

    return response!.output_text





};

