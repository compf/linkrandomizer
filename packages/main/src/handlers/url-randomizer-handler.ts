import { shell } from 'electron';
import type { UrlRandomizerService } from '../../../common/dist/index.js';
import { generateRandomURL,  type Website } from '@linkrandomizer/common';
import { chromium } from 'playwright';
import { sampleWebsites, saveWebsites, loadWebsites, addWebsite } from './websites-data.js';
import { performInteractiveAnalysis } from './ai-analysis.js';
import { exec } from 'child_process';
import { executeBrowserAction, type GetLinksAction } from './actions.js';

export const UrlRandomizerHandler = {
    sendToBackend: {
        generateRandomUrls: (data: { website: Website; count: number }, event: any) => {
            const urls: string[] = [];
            for (let i = 0; i < data.count; i++) {
                urls.push(generateRandomURL(data.website));
            }
            event.sender.send('randomUrlsGenerated', urls);
        },

        analyzeWebsite: async (data: { url: string; existingLinks: string[] }, event: any) => {
            const status = (text: string) => event.sender.send('websiteAnalysisStatus', text);
            status('analysis_started');

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
                status('page_loaded');

                // Get initial links
                const getLinksAction = { actionType: 'getLinks' } as GetLinksAction
               const links= await executeBrowserAction(getLinksAction , page, output    );
                const schemas=await performInteractiveAnalysis(output,page);
                for(const s of schemas){
                    addWebsite(s);
                }
                saveWebsites();
                
                status('initial_links_extracted');


        
                await browser.close();
                event.sender.send('websiteAnalysisComplete', schemas);

               

            } catch (error) {
                console.error('Error analyzing website:', error);
                // Return basic schema on error
                const schemas: Website[] = [{
                    name: "error-fallback",
                    tags: ["error"],
                    variables: [],
                    schema: [data.url]
                }];
                event.sender.send('websiteAnalysisComplete', schemas);
            }
        },

        openUrlInBrowser: (data: { url: string }) => {
            shell.openExternal(data.url);
        }
    },

    invokeFromBackend: {
        getAvailableWebsites: async (): Promise<Website[]> => {
            console.log("getAvailableWebsites called, returning:", sampleWebsites.length, "websites");
            return sampleWebsites;
        },

        saveWebsites: async (): Promise<void> => {
            saveWebsites();
        }
    }
};