import { dialog } from 'electron';
import { chromium } from 'playwright';
import {
    type RegexWebsiteControllerDefinition,
    type WebsiteService,
} from '@linkrandomizer/common';
import { sendToControlWindow } from '../mainBackend.js';
import { findURLS, setActive } from '../agent/simple-url-finder.js';
import type { WebsiteController } from '../../url-finder-type.js';
import {
    CONTROLLER_SCRIPTS_DIR,
    controllerFromDefinition,
    listControllerDefinitions,
    loadControllerDefinition,
    loadControllerFromFile,
    saveControllerDefinition,
} from '../agent/regex-controller.js';

const finishAnalysis = () => {
    setActive(false);
    sendToControlWindow('webSiteAnalysisFinished', undefined);
};

const runCrawl = async (controllers: WebsiteController[]) => {
    if (controllers.length === 0) {
        finishAnalysis();
        return;
    }
    const browser = await chromium.launch({ headless: false,

     });
    const page = await browser.newPage({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    try {
        await findURLS(page, controllers);
    } finally {
        await browser.close();
        finishAnalysis();
    }
};

export const WebsiteHandler: WebsiteService = {
    sendToBackend: {
        setActive: (active: boolean): void => {
            setActive(active);
        },

        analyzeWebsite: async (data: { controllerNames: string[]; openFilePicker?: boolean }): Promise<void> => {
            try {
                const controllers: WebsiteController[] = [];

                if (data.openFilePicker) {
                    const filePaths = dialog.showOpenDialogSync({
                        title: "Select website controller(s)",
                        defaultPath: CONTROLLER_SCRIPTS_DIR,
                        filters: [
                            { name: "Controllers", extensions: ["json", "js"] },
                            { name: "JSON", extensions: ["json"] },
                            { name: "JavaScript", extensions: ["js"] },
                        ],
                        properties: ["openFile", "multiSelections"],
                    });
                    if (!filePaths?.length) {
                        finishAnalysis();
                        return;
                    }
                    for (const filePath of filePaths) {
                        controllers.push(await loadControllerFromFile(filePath));
                    }
                } else {
                    const names = data.controllerNames ?? [];
                    if (names.length === 0) {
                        finishAnalysis();
                        return;
                    }
                    for (const name of names) {
                        const def = loadControllerDefinition(name);
                        if (!def) {
                            throw new Error(`Controller not found: ${name}`);
                        }
                        controllers.push(controllerFromDefinition(def));
                    }
                }

                await runCrawl(controllers);
            } catch (error) {
                console.error('Error analyzing website:', error);
                finishAnalysis();
            }
        },
    },

    invokeFromBackend: {
        listControllerDefinitions: async (): Promise<RegexWebsiteControllerDefinition[]> => {
            return listControllerDefinitions();
        },
        saveControllerDefinition: async (
            def: RegexWebsiteControllerDefinition,
        ): Promise<{ ok: true; jsonPath: string; jsPath: string } | { ok: false; error: string }> => {
            try {
                const paths = saveControllerDefinition(def);
                return { ok: true, ...paths };
            } catch (error) {
                return {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        },
        loadControllerDefinition: async (
            data: { name: string },
        ): Promise<RegexWebsiteControllerDefinition | null> => {
            return loadControllerDefinition(data.name);
        },
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
