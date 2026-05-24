import { ChatHistory, ChatMessage, GeneratedURL, UrlService } from "@linkrandomizer/common";
import { registerOrCallCallback } from "./frontend-service";

export const FrontendUrlHandler:UrlService={
    sendToBackend:{
        openUrlInBrowser:(data:{url:string}):void=>{
            window.open(data.url, '_blank');
        },
        obtainUrlContent:(data:{generatedURL:GeneratedURL,type:"downloadFromGeneratedURL" | "downloadFromURLInClipboard" | "screenshotInClipboard"}):void=>{
            console.log("obtainUrlContent", data);
        }
    },
    invokeFromBackend:{
        explainUrl:(data:{url:GeneratedURL,messages:ChatHistory}):Promise<string>=>{
            return Promise.resolve("Explanation of URL");
        }   
    },
    eventFromBackend:{
        onContentLoaded:(data?:ChatMessage,callback?:(data:ChatMessage)=>void):void=>{
           registerOrCallCallback("onContentLoaded",callback,data);
        }
    }
}