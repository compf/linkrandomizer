import {type UrlService, type GeneratedURL, type ClipBoardData, type ChatHistory} from "@linkrandomizer/common";
import { shell } from "electron/common";
import { explainURL } from "../ai/explain-url.js";
import { ClipboardManager } from "../agent/clipboard-manager.js";
import { sendToControlWindow } from "../mainBackend.js";
const clipboardManager=new ClipboardManager();
export const UrlHandler:UrlService={
    sendToBackend:{
        openUrlInBrowser:(data:{url:string}):void=>{
            shell.openExternal(data.url);
        
        },
        updateClipBoard():void{
            clipboardManager.updateClipboard();
        }
    
    },
    invokeFromBackend:{
        explainUrl(data:{url:GeneratedURL,messages:ChatHistory}):Promise<string>{
           
            return explainURL(data.url, data.messages);
        }
      
    },
    eventFromBackend:{

        onClipboardUpdate(data?:ClipBoardData,callback?:(data:ClipBoardData)=>void):void{
            sendToControlWindow("onClipboardUpdate",data)
        }
    }
    
}