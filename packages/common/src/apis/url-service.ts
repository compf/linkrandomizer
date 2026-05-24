import { GeneratedURL } from "../models/generated_url.js";
import { unsupported } from "./abstract-service.js";
export type ChatMessage={
    type:"text"|"image"|"file",
    text?:string|undefined;
    image?:ArrayBufferLike|undefined,
    file?:{
    name:string,
    data:ArrayBufferLike
    } | undefined
}
export type ChatHistory={
    content:ChatMessage,
    sender:"user" | "assistant"
}[]
export const UrlServiceSchema={
    sendToBackend:{
        openUrlInBrowser:(data:{url:string}):void=>unsupported(),
        obtainUrlContent:(data:{generatedURL: GeneratedURL, type: "downloadFromGeneratedURL" | "downloadFromURLInClipboard" | "screenshotInClipboard"}):void=>unsupported()
    },
    invokeFromBackend:{
        explainUrl:(data:{url:GeneratedURL,messages:ChatHistory}):Promise<string>=>unsupported(),
        getKey:():Promise<string>=>unsupported()
    },
    eventFromBackend:{

        onContentLoaded:(data?:ChatMessage,callback?:(data:ChatMessage)=>void):void => unsupported()


    }
}

export type UrlService=typeof UrlServiceSchema