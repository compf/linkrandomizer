import { dialog } from 'electron';
import { chromium } from 'playwright';
import { type WebsiteService } from '@linkrandomizer/common';
import { sendToControlWindow } from '../mainBackend.js';
import { findURLS, setActive } from '../agent/simple-url-finder.js';
import type { WebsiteController } from '../../url-finder-type.js';

export const WebsiteHandler: WebsiteService = {
    sendToBackend: {
        setActive: (active: boolean): void => {
            setActive(active);
        },

        analyzeWebsite: async (_data: { url: string; maxDepth: number; canBeVisitedRegex: string; canBeReturnedRegex: string }): Promise<void> => {
            try {
                const filePaths = dialog.showOpenDialogSync({
                    title: "Select website controller(s)",
                    filters: [{ name: "js", extensions: ["js"] }],
                    properties: ["openFile", "multiSelections"],
                });
                if (!filePaths?.length) {
                    setActive(false);
                    sendToControlWindow('webSiteAnalysisFinished', undefined);
                    return;
                }

                const controllers: WebsiteController[] = [];
                for (const filePath of filePaths) {
                    const module = await import(filePath);
                    const controller = Object.values(module)[0] as WebsiteController;
                    controllers.push(controller);
                }

                const browser = await chromium.launch({ headless: false });
                const page = await browser.newPage();
                try {
                    await findURLS(page, controllers);
                } finally {
                    await browser.close();
                    setActive(false);
                    sendToControlWindow('webSiteAnalysisFinished', undefined);
                }
            } catch (error) {
                console.error('Error analyzing website:', error);
                setActive(false);
                sendToControlWindow('webSiteAnalysisFinished', undefined);
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
        webSiteAnalysisFinished: (callback?: () => void): void => {
            sendToControlWindow('webSiteAnalysisFinished', undefined);
        },
    }
};
