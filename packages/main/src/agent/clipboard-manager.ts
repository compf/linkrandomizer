import { clipboard } from "electron";
import { sendToControlWindow } from "../mainBackend.js";
import { UrlHandler } from "../handlers/url-handler.js";
export class ClipboardManager {

    private previousClipBoardBase64: string | null = null;
    private previousClipBoardText: string | null = null;

    public updateClipboard() {
        const availableFormats = clipboard.availableFormats()
        if (availableFormats.length > 0) {
            if (availableFormats.includes("text/plain")) {
                const text = clipboard.readText()
                if (text === this.previousClipBoardText) {
                    return;
                }
                this.previousClipBoardText = text;
                UrlHandler.eventFromBackend.onClipboardUpdate({ type: "text", text, image: undefined })
            }
            else if (availableFormats.includes("image/png")) {
                const image = clipboard.readImage().toPNG()
                const base64Image = Buffer.from(image).toString('base64');
                if (base64Image === this.previousClipBoardBase64) {
                    return;
                }
                this.previousClipBoardBase64 = base64Image;
                UrlHandler.eventFromBackend.onClipboardUpdate({ type: "image", text: undefined, image: image.buffer })
            }

        }
    }
}