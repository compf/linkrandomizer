import {type UrlService, type GeneratedURL} from "@linkrandomizer/common";
import { shell } from "electron/common";
import { explainURL } from "../ai/explain-url.js";
export const UrlHandler:UrlService={
    sendToBackend:{
        openUrlInBrowser:(data:{url:string}):void=>{
            shell.openExternal(data.url);
        
        },
    
    },
    invokeFromBackend:{
        explainUrl(data:{url:GeneratedURL,messages:{text:string,sender:"user" | "assistant"}[]}):Promise<string>{
            return explainURL(data.url, data.messages);
        }
    },
    eventFromBackend:{}
    
}