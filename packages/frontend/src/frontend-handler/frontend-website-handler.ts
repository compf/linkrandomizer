import { Website, WebsiteService } from "@linkrandomizer/common";
import { registerOrCallCallback } from "./frontend-service";

export const FrontendWebsiteHandler:WebsiteService={
    sendToBackend:{
        analyzeWebsite:(data:{url:string,existingLinks:string[]}):void=>{
            console.log("analyzeWebsite", data);
        }
    },
    invokeFromBackend:{
        
    },
    eventFromBackend:{
        randomUrlsGenerated:(urls:string[],callback?:(urls:string[])=>void):void=>{
          registerOrCallCallback("randomUrlsGenerated",callback,urls);
        },
        websiteAnalysisComplete:(schemas:Website[],callback?:(schemas:Website[])=>void):void=>{
            console.log("websiteAnalysisComplete", schemas);
            registerOrCallCallback("websiteAnalysisComplete",callback,schemas);
        },
        websiteAnalysisStatus:(status:string,callback?:(status:string)=>void):void=>{
            console.log("websiteAnalysisStatus", status);
            registerOrCallCallback("websiteAnalysisStatus",callback,status);
        }
    }
}