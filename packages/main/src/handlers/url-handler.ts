import { type UrlService, type GeneratedURL, type ChatMessage, type ChatHistory, explainURL, generateRankScript } from "@linkrandomizer/common";
import { shell } from "electron/common";
import { sendToControlWindow } from "../mainBackend.js";
import { GeneratedURLContentObtainer, ImageInClipboardObtainer, UrlInClipboardObtainer } from "../agent/content-obtainer.js";
export const UrlHandler: UrlService = {
    sendToBackend: {
        openUrlInBrowser: (data: { url: string }): void => {
            shell.openExternal(data.url);

        },
        obtainUrlContent(data: { generatedURL: GeneratedURL, type: "downloadFromGeneratedURL" | "downloadFromURLInClipboard" | "screenshotInClipboard" }): void {
            const { generatedURL, type } = data;
            console.log("Obtaining URL content. GeneratedURL:", generatedURL, "Type:", type);
            if (type === "downloadFromGeneratedURL") {
                const obtainer = new GeneratedURLContentObtainer();
                obtainer.loadContent(generatedURL);
            }
            else if (type === "downloadFromURLInClipboard") {
                const obtainer = new UrlInClipboardObtainer();
                obtainer.loadContent(generatedURL);
            }
            else if (type === "screenshotInClipboard") {
                const obtainer = new ImageInClipboardObtainer();
                obtainer.loadContent(generatedURL);
            }
        }

    },
    invokeFromBackend: {
        explainUrl(data: { url: GeneratedURL, messages: ChatHistory }): Promise<string> {
            try{
                return explainURL(data.url, data.messages);
            }

            catch(error){
                return Promise.resolve("Error explaining URL:"+(error instanceof Error ? error.message : String(error)));
            }
        },
        generateRankScript(data: { preferences: string; target: "url" | "website" | "both" }): Promise<string> {
            try {
                return generateRankScript(data.preferences, data.target);
            } catch (error) {
                return Promise.resolve(
                    "Error generating rank script:" + (error instanceof Error ? error.message : String(error))
                );
            }
        },
        async getKey(): Promise<string> {
            if(!apiKey){
                const config=await import("../config.js")
                apiKey=config.default;
            }
            return Promise.resolve(apiKey);
        }

    },
    eventFromBackend: {

        onContentLoaded(data?: ChatMessage, callback?: (data: ChatMessage) => void): void {
            sendToControlWindow("onContentLoaded", data)
        }
    }

}

let  apiKey:string|undefined=undefined;