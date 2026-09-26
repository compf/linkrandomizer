import { ChatHistory, ChatMessage, explainURL, generateRankScript, GeneratedURL, UrlService } from "@linkrandomizer/common";
import {  registerOrCallCallback } from "./frontend-service";
const openFileDialog=async():Promise<{
    name:string,
    data:ArrayBuffer
}|undefined>=>{
    return new Promise((resolve,reject)=>{
    const input=document.createElement("input");
    input.type="file";
    input.accept="text/plain,application/pdf,image/png,image/jpeg,image/gif";
    input.onchange=async()=>{
        const file=input.files?.[0];
        if(file){
            const fileData=await file.arrayBuffer();
            resolve({name:file.name,data:fileData});
        }
    }
    input.click();
    })
}
export const FrontendUrlHandler:UrlService={
    sendToBackend:{
        openUrlInBrowser:(data:{url:string}):void=>{
            window.open(data.url, '_blank');
        },
        obtainUrlContent:(data:{generatedURL:GeneratedURL,type:"downloadFromGeneratedURL" | "downloadFromURLInClipboard" | "screenshotInClipboard"}):void=>{
           if(data.type==="downloadFromURLInClipboard" || data.type==="downloadFromGeneratedURL"){
            // browser only allows providing files if user open it. So we need to show the open file dialog to the user.
            openFileDialog().then(fileData=>{
                if(fileData){
                    FrontendUrlHandler.eventFromBackend.onContentLoaded({type:"file",text:undefined,image:undefined,file:fileData});
                }
            })
            return;

           }
            window.navigator.clipboard.read().then(clipboardData=>{

            if(data.type==="screenshotInClipboard"){
                const image=clipboardData.find((it)=>it.types.includes("image/png"))
                if(image){
                    image.getType("image/png").then(imageData=>{
                        imageData.arrayBuffer().then(arrayBuffer=>{
                        FrontendUrlHandler.eventFromBackend.onContentLoaded({type:"image",image:arrayBuffer,text:undefined});
                    })
                    
                    })
                }
            }
        });
    }
    },
    invokeFromBackend:{
        explainUrl:(data:{url:GeneratedURL,messages:ChatHistory}):Promise<string>=>{
           return explainURL(data.url, data.messages);
        },
        generateRankScript:(data:{preferences:string,target:"url"|"website"|"both"}):Promise<string>=>{
            return generateRankScript(data.preferences, data.target);
        },
        getKey(): Promise<string> {
            return Promise.resolve(getStoredApiKey());
        },
        // The web build has no crawl DB; it serves snapshots exported by the
        // Electron app as static assets (see angular.json "extracted-urls").
        getUrlPool: async (data: { site: string }): Promise<string[]> => {
            const response = await fetch(`extracted-urls/${data.site}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load URL pool for ${data.site}: ${response.status}`);
            }
            const parsed = (await response.json()) as { urlsToReturn?: unknown };
            return Array.isArray(parsed?.urlsToReturn) ? (parsed.urlsToReturn as string[]) : [];
        }
    },
    eventFromBackend:{
        onContentLoaded:(data?:ChatMessage,callback?:(data:ChatMessage)=>void):void=>{
           registerOrCallCallback("onContentLoaded",callback,data);
        }
    }
}

const API_KEY_STORAGE_KEY = "linkrandomizer.openaiApiKey";

const readStoredApiKey = (): string => {
    try {
        return localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() ?? "";
    } catch {
        return "";
    }
};

let apiKey = readStoredApiKey();

export const getStoredApiKey = (): string => apiKey;

export const setStoredApiKey = (key: string): void => {
    apiKey = key.trim();
    try {
        if (apiKey) {
            localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
        } else {
            localStorage.removeItem(API_KEY_STORAGE_KEY);
        }
    } catch {
        // Storage can be unavailable; the in-memory key still applies for this session.
    }
};