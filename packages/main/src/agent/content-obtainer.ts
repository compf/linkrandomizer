import type { GeneratedURL } from "@linkrandomizer/common";
import { UrlHandler } from "../handlers/url-handler.js";
import { clipboard } from "electron/common";


export interface ContentObtainer {
    loadContent(generateURL: GeneratedURL): Promise<void>
}
export const getFileDataFromURL = async (url: string): Promise<ArrayBuffer> => {
    const response = await fetch(url)
    console.log("Fetched content from URL:", url, "Response:", response);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return arrayBuffer;
}

export class GeneratedURLContentObtainer implements ContentObtainer {
    async loadContent(generateURL: GeneratedURL): Promise<void> {
      
        const arrayBuffer = await getFileDataFromURL(generateURL.url);
        UrlHandler.eventFromBackend.onContentLoaded({ type: "file", text: undefined, image: undefined, file: { name: "test", data: arrayBuffer } })
        
    }
}

export class UrlInClipboardObtainer implements ContentObtainer {
    async loadContent(generateURL: GeneratedURL): Promise<void> {
        console.log("Attempting to read URL from clipboard...");
        const url = await clipboard.readText();
        console.log("Read URL from clipboard:", url);
        const arrayBuffer = await getFileDataFromURL(url);
        console.log("Obtained content from URL in clipboard. URL:", url, "ArrayBuffer:", arrayBuffer);
        UrlHandler.eventFromBackend.onContentLoaded({ type: "file", text: undefined, image: undefined, file: { name: "test", data: arrayBuffer } })
    }
}

export class ImageInClipboardObtainer implements ContentObtainer {
    async loadContent(generateURL: GeneratedURL): Promise<void> {
        try {
            const image = clipboard.readImage().toPNG()
            UrlHandler.eventFromBackend.onContentLoaded({ type: "image", text: undefined, image: image.buffer })
        }
        catch (error) {
            console.error("Error accessing clipboard:", error);
        }
    }
}