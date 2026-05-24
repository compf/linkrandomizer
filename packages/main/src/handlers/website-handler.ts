import { shell } from 'electron';
import { chromium } from 'playwright';
import { performInteractiveAnalysis } from '../ai/ai-assisted-schema-finder.js';
import { exec } from 'child_process';
import { executeBrowserAction, type GetLinksAction } from '../agent/actions.js';
import { generateRandomURL, type GeneratedURL, type Website, type WebsiteService } from '@linkrandomizer/common';
import { explainURL } from '../ai/explain-url.js';
import { type ChatHistory } from '@linkrandomizer/common';
import { publicWebsites } from '@linkrandomizer/common';
import { sendToControlWindow } from '../mainBackend.js';
export const WebsiteHandler: WebsiteService = {
    sendToBackend: {
        

        analyzeWebsite: async (data: { url: string; existingLinks: string[] }): Promise<void> => {

            try {
                // Launch browser for interactive analysis
                const browser = await chromium.launch({ headless: false });
                const page = await browser.newPage();
    
                const collectedUrls = new Set<string>();
                const visitedPages = new Set<string>();
                const output: string[] = [];

                // Start with initial page
                await executeBrowserAction({ actionType: 'goto', url: data.url }, page, output);
                visitedPages.add(data.url);
                //await page.waitForTimeout(20_000);

                // Get initial links
                const getLinksAction = { actionType: 'getLinks' } as GetLinksAction
               const links= await executeBrowserAction(getLinksAction , page, output    );
                const schemas=await performInteractiveAnalysis(output,page);
              
                console.log("schemas:", schemas);
                


        
                await browser.close();

               

            } catch (error) {
                console.error('Error analyzing website:', error);
              
            }
        },
 

       
    },

    invokeFromBackend: {
       
       

        
    },
    eventFromBackend: {
        randomUrlsGenerated: (urls: string[], callback?: (urls: string[]) => void): void => {
                sendToControlWindow('randomUrlsGenerated', urls);
            },
        websiteAnalysisComplete: (schemas: Website[], callback?: (schemas: Website[]) => void): void => {
            sendToControlWindow('websiteAnalysisComplete', schemas);
        },
        websiteAnalysisStatus: (status: string, callback?: (status: string) => void): void => {
            sendToControlWindow('websiteAnalysisStatus', status);
        }
    }
};