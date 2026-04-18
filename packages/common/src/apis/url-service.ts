import { GeneratedURL } from "../models/generated_url.js";
import { unsupported } from "./abstract-service.js";
export type ClipBoardData={
    type:"text"|"image"
    text?:string|undefined;
    image?:ArrayBufferLike|undefined
}
export type ChatHistory={
    content:ClipBoardData,
    sender:"user" | "assistant"
}[]
export const UrlServiceSchema={
    sendToBackend:{
        openUrlInBrowser:(data:{url:string}):void=>unsupported(),
        updateClipBoard:():void=>unsupported()
    },
    invokeFromBackend:{
        explainUrl:(data:{url:GeneratedURL,messages:ChatHistory}):Promise<string>=>unsupported()
    },
    eventFromBackend:{

        onClipboardUpdate:(data?:ClipBoardData,callback?:(data:ClipBoardData)=>void):void => unsupported()


    }
}

export type UrlService=typeof UrlServiceSchema