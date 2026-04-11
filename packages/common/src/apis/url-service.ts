import { GeneratedURL } from "../models/generated_url.js";
import { unsupported } from "./abstract-service.js";
export const UrlServiceSchema={
    sendToBackend:{
        openUrlInBrowser:(data:{url:string}):void=>unsupported()
    },
    invokeFromBackend:{
        explainUrl:(data:{url:GeneratedURL,messages:{text:string,sender:"user" | "assistant"}[]}):Promise<string>=>unsupported()
    },
    eventFromBackend:{
    }
}

export type UrlService=typeof UrlServiceSchema