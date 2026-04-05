import type { Page } from 'playwright';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import { normalizeWebsite, getHeuristicWebsiteFromLinks } from './validation.js';
import { opennAI_API_KEY } from '../config.js';
import { url } from 'inspector';
import {z} from 'zod';
import { BrowserActionSchema, executeBrowserAction } from './actions.js';
import { exec } from 'child_process';
import { type Website, WebsiteSchema } from '@linkrandomizer/common';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey:  opennAI_API_KEY
});
export const ReplySchema = z.object({
    actions:z.array(BrowserActionSchema),
    analysis_complete:z.boolean(),
    schemas:z.array(WebsiteSchema)
});


export const performInteractiveAnalysis = async (
    context:string[],
    page: Page
): Promise<Website[]> => {
    let schemas: Website[] = [];




        // Interactive analysis prompt
        const interactivePrompt = `You are an AI assistant tasked with analyzing a website to find URL patterns that can be randomized.

Your goal is to explore this website interactively to discover URL patterns that contain variables (like IDs, dates, categories, etc.) that can be randomized.

Available actions you can take:
- goto(url): Navigate to a specific URL
- click(selector): Click on an element (use CSS selectors like 'a[href*="page"]', 'button', '.next-page')
- fill(selector, text): Fill a form field
- getLinks(): Get all links on current page
- waitForSelector(selector): Wait for an element to appear
- getPageContent(): Get page HTML content

Strategy:
1. Look for pagination patterns, search results, item listings
2. Try clicking on "next page", "load more", or navigation elements
3. Look for URLs with numbers, dates, or other variable parts
4. Visit different sections of the site
5. Try search functionality if available

After exploring, analyze all collected URLs and create URL schemas with variables.

IMPORTANT: Respond with a JSON object 
`
        let analysisComplete = false;
        let explorationRound = 0;
        const maxRounds = 10;
        const dialog: ChatCompletionMessageParam[] = [{ role: 'system', content: interactivePrompt }];
        dialog.push(...context.map((c) => ({ role: 'user', content: c } as ChatCompletionMessageParam)));
        do{
            console.log("##################################################")

        console.log("dialog", dialog)

        const response=await openai.chat.completions.parse({
            model:"gpt-4o",
            max_tokens: 2000,
            stream:false,
            messages: dialog,

          response_format: zodResponseFormat(ReplySchema, "reply"),
        })
       
        const parsed=ReplySchema.parse(JSON.parse(response.choices[0]!.message.content??"{}"))
        dialog.push({role:"assistant",content:response.choices[0]!.message.content??""})
        console.log("Parsed response:", parsed)

        const output: string[] = [];
        for(const action of parsed.actions){
            await executeBrowserAction(action, page, output)
            dialog.push({role:"user",content:output.join("\n")})
        }
        schemas.push(...parsed.schemas);
        analysisComplete=parsed.analysis_complete;
        console.log("###################################################")
    }while(!analysisComplete && explorationRound++ < maxRounds)

       
    return schemas;
};

