import { dialog } from 'electron';
import {
    type ControllerAssistRequest,
    type ControllerAssistResult,
    type InducedSchemaRecord,
    type InduceSchemaResult,
    type RegexWebsiteControllerDefinition,
    type WebsiteService,
} from '@linkrandomizer/common';
import { proposeController } from '../ai/controller-assistant.js';
import { sendToControlWindow } from '../mainBackend.js';
import { runCrawl as runCrawlLoop, setActive } from '../crawler/crawl-loop.js';
import { harvestSite } from '../crawler/harvest.js';
import { induceSchemaForSite, listInducedSchemas } from '../ai/schema-inducer.js';
import { getCrawlStore } from '../storage/crawl-store.js';
import type { WebsiteController } from '../../url-finder-type.js';
import {
    CONTROLLER_SCRIPTS_DIR,
    controllerFromDefinition,
    deleteControllerDefinition,
    listControllerDefinitions,
    loadControllerDefinition,
    loadControllerFromFile,
    saveControllerDefinition,
} from '../agent/regex-controller.js';
import { exportInducedSchemasSnapshot } from '../ai/schema-inducer.js';

const finishAnalysis = () => {
    setActive(false);
    sendToControlWindow('webSiteAnalysisFinished', undefined);
};

const runCrawl = async (controllers: WebsiteController[]) => {
    if (controllers.length === 0) {
        finishAnalysis();
        return;
    }
    try {
        await runCrawlLoop(controllers, {
            callbacks: {
                onProgress: (total) => sendToControlWindow('webSiteAnalysisStateChanged', total),
            },
        });
    } finally {
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

        harvestSite: async (data: { site: string }): Promise<void> => {
            try {
                setActive(true);
                await harvestSite(data.site, {
                    onProgress: (total) => sendToControlWindow('webSiteAnalysisStateChanged', total),
                });
            } catch (error) {
                console.error('Error harvesting site:', error);
            } finally {
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
        deleteControllerDefinition: async (
            data: { name: string },
        ): Promise<{ ok: true } | { ok: false; error: string }> => {
            try {
                deleteControllerDefinition(data.name);
                return { ok: true };
            } catch (error) {
                return { ok: false, error: error instanceof Error ? error.message : String(error) };
            }
        },
        listCrawledSites: async (): Promise<{ name: string; urlCount: number }[]> => {
            const store = await getCrawlStore();
            return store.listSites().map(({ name }) => ({ name, urlCount: store.countReturned(name) }));
        },
        deleteInducedSchema: async (
            data: { site: string },
        ): Promise<{ ok: true } | { ok: false; error: string }> => {
            try {
                const store = await getCrawlStore();
                store.deleteSchema(data.site);
                exportInducedSchemasSnapshot(store);
                return { ok: true };
            } catch (error) {
                return { ok: false, error: error instanceof Error ? error.message : String(error) };
            }
        },
        deleteCrawledSite: async (
            data: { site: string },
        ): Promise<{ ok: true } | { ok: false; error: string }> => {
            try {
                const store = await getCrawlStore();
                store.deleteSite(data.site);
                exportInducedSchemasSnapshot(store);
                return { ok: true };
            } catch (error) {
                return { ok: false, error: error instanceof Error ? error.message : String(error) };
            }
        },
        induceSchema: async (data: { site: string }): Promise<InduceSchemaResult> => {
            try {
                const record = await induceSchemaForSite(data.site);
                return { ok: true, record };
            } catch (error) {
                console.error('Error inducing schema:', error);
                return { ok: false, error: error instanceof Error ? error.message : String(error) };
            }
        },
        listInducedSchemas: async (): Promise<InducedSchemaRecord[]> => listInducedSchemas(),
        proposeController: async (data: ControllerAssistRequest): Promise<ControllerAssistResult> => {
            try {
                return await proposeController(data);
            } catch (error) {
                console.error('Error proposing controller:', error);
                return { ok: false, error: error instanceof Error ? error.message : String(error) };
            }
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
