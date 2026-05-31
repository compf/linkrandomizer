import { Website, WebsiteService } from "@linkrandomizer/common";
import { registerOrCallCallback } from "./frontend-service";

export const FrontendWebsiteHandler:WebsiteService={
    sendToBackend:{
        analyzeWebsite:(data:{url:string,maxDepth:number}):void=>{
            console.log("analyzeWebsite", data);
        },
        setActive:(active:boolean):void=>{
            console.log("setActive", active);
        }
    },
    invokeFromBackend:{
        
    },
    eventFromBackend:{
        randomUrlsGenerated:(urls:string[],callback?:(urls:string[])=>void):void=>{
          registerOrCallCallback("randomUrlsGenerated",callback,urls);
        },
        
        webSiteAnalysisStateChanged:(status:number,callback?:(status:number)=>void):void=>{
            console.log("websiteAnalysisStatus", status);
            registerOrCallCallback("webSiteAnalysisStateChanged",callback,status);
        }
    }
}