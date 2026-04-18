import { GeneratedURL } from "../models/generated_url.js";
import { unsupported } from "./abstract-service.js";
export type Message={
    type:"text"|"image"|"file",
    text?:string|undefined;
    image?:ArrayBufferLike|undefined,
    file?:{
    name:string,
    data:ArrayBufferLike
    } | undefined
}
export type ChatHistory={
    content:Message,
    sender:"user" | "assistant"
}[]
export const UrlServiceSchema={
    sendToBackend:{
        openUrlInBrowser:(data:{url:string}):void=>unsupported(),
        updateSystemWatchers:(  type:"clipboard"|"file"):void=>unsupported()
    },
    invokeFromBackend:{
        explainUrl:(data:{url:GeneratedURL,messages:ChatHistory}):Promise<string>=>unsupported()
    },
    eventFromBackend:{

        onSystemStateUpdate:(data?:Message,callback?:(data:Message)=>void):void => unsupported()


    }
}

export type UrlService=typeof UrlServiceSchema