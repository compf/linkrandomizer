import {type UrlService, type GeneratedURL, type Message, type ChatHistory} from "@linkrandomizer/common";
import { shell } from "electron/common";
import { explainURL } from "../ai/explain-url.js";
import { sendToControlWindow } from "../mainBackend.js";
import { updateSystemWatchers } from "../agent/system-watcher.js";
export const UrlHandler:UrlService={
    sendToBackend:{
        openUrlInBrowser:(data:{url:string}):void=>{
            shell.openExternal(data.url);
        
        },
        updateSystemWatchers(type:"clipboard"|"file"):void{
            updateSystemWatchers(type);
        }
    
    },
    invokeFromBackend:{
        explainUrl(data:{url:GeneratedURL,messages:ChatHistory}):Promise<string>{
           
            return explainURL(data.url, data.messages);
        }
      
    },
    eventFromBackend:{

        onSystemStateUpdate(data?:Message,callback?:(data:Message)=>void):void{
            sendToControlWindow("onSystemStateUpdate",data)
        }
    }
    
}