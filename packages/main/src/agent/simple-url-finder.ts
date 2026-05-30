import type { Page } from "playwright";
import { ur } from "zod/locales";
import fs from "fs";
import { sendToControlWindow } from "../mainBackend.js";
import type { ExtractedUrls, WebsiteController } from "../../url-finder-type.js";
let isActive=false;



export const setActive = (active:boolean)=>{
    isActive=active;
}
export const findURLS = async (page: Page, controller:WebsiteController): Promise<ExtractedUrls> => {
   
    await page.goto(controller.initialUrl());
    await page.waitForTimeout(5000);

    const visitedUrls:Record<string,number|null>={};
    const initialUrl=controller.initialUrl();
    const maxDepth=controller.maxDepth();
    visitedUrls[initialUrl]=0
    let currUrl:string|undefined=initialUrl;
    do{
        await page.waitForTimeout(250);
        if((await controller.requireUserAttention(page))){
            continue
        }
        currUrl=Object.keys(visitedUrls).find(url=>  controller.canBeVisited(url) && visitedUrls[url]!==null && visitedUrls[url]!==undefined && visitedUrls[url]<maxDepth);
        if(!currUrl){
            break;
        }
        visitedUrls[currUrl]=null;
        console.log("currUrl:", currUrl);

        await page.goto(currUrl,{waitUntil:"domcontentloaded"});

        const currDepth=visitedUrls[currUrl]!;
        const links = await page.locator('a').all();
        for(const link of links){
            let href = await link.getAttribute('href');
            if(href && !href.startsWith("http")){
                href=join(initialUrl,href,"/");
            }
            if(href && visitedUrls[href]===undefined && controller.canBeVisited(href)){
               visitedUrls[href]=currDepth+1;
            }
        }
        const extractedUrls:ExtractedUrls={
            name:controller.initialUrl(),
            prefixToUrls:{
                "":Object.keys(visitedUrls).filter(url=>controller.canBeReturned(url))
            }
        };
        fs.writeFileSync("visitedUrls.json", JSON.stringify(extractedUrls, null, 2));
        sendToControlWindow('webSiteAnalysisStateChanged',extractedUrls.prefixToUrls[""]?.length);
        console.log("visitedUrls:", extractedUrls);
    }while(currUrl);

    const extractedUrls:ExtractedUrls={
        name:controller.initialUrl(),
        prefixToUrls:{
            "":Object.keys(visitedUrls).filter(url=>controller.canBeReturned(url))
        }
    };
    return extractedUrls;

   
}

const join=(part1:string,part2:string, separator:string)=>{
   if(part1.endsWith(separator)  && !part2.startsWith(separator)){
    return part1+part2;
   }
   else if(part2.startsWith(separator) && !part1.endsWith(separator)){
    return part1+part2;
   }
   else if(!part1.endsWith(separator) && !part2.startsWith(separator))  {
    return part1+separator+part2;
   }
   else{
    return part1.slice(0,-separator.length)+separator+part2.slice(separator.length);
   }
}

