import { type UrlService, type GeneratedURL, type ChatMessage, type ChatHistory } from "@linkrandomizer/common";
import { shell } from "electron/common";
import { explainURL } from "../ai/explain-url.js";
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

            return explainURL(data.url, data.messages);
        }

    },
    eventFromBackend: {

        onContentLoaded(data?: ChatMessage, callback?: (data: ChatMessage) => void): void {
            sendToControlWindow("onContentLoaded", data)
        }
    }

}