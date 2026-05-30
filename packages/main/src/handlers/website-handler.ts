import { dialog, shell } from 'electron';
import { chromium } from 'playwright';
import { performInteractiveAnalysis } from '../ai/ai-assisted-schema-finder.js';
import { exec } from 'child_process';
import { executeBrowserAction, type GetLinksAction } from '../agent/actions.js';
import { generateRandomURL, type GeneratedURL, type Website, type WebsiteService } from '@linkrandomizer/common';
import { type ChatHistory } from '@linkrandomizer/common';
import { publicWebsites } from '@linkrandomizer/common';
import { sendToControlWindow } from '../mainBackend.js';
import { findURLS, setActive } from '../agent/simple-url-finder.js';
import fs from 'fs';
import type { WebsiteController } from '../../url-finder-type.js';
export const WebsiteHandler: WebsiteService = {
    sendToBackend: {
        setActive: (active: boolean): void => {
            setActive(active);
        },

        analyzeWebsite: async (data: { url: string; maxDepth: number; canBeVisitedRegex: string; canBeReturnedRegex: string }): Promise<void> => {

            try {
                // Launch browser for interactive analysis
                const browser = await chromium.launch({ headless: false });
                const page = await browser.newPage();
                const filePath=dialog.showOpenDialogSync({title:"Select a file",filters:[{name:"js",extensions:["js"]}]})
                if(!filePath?.[0]){
                    return;
                }
                const module=await (import(filePath?.[0]))
                const controller=Object.values(module)[0] as WebsiteController;
                const urls = await findURLS(page, controller);
                console.log("urls:", urls);
    
               
                


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
        webSiteAnalysisStateChanged: (state: number, callback?: (state: number) => void): void => {
            sendToControlWindow('webSiteAnalysisStateChanged', state);
        },
       
    }
};