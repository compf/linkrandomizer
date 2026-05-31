import type { Page } from "playwright";
import { ur } from "zod/locales";
import fs from "fs";
import { sendToControlWindow } from "../mainBackend.js";
import type { ExtractedUrls, WebsiteController } from "../../url-finder-type.js";
import path from "path";
let isActive=false;



export const setActive = (active:boolean)=>{
    isActive=active;
}
const SAVE_FREQUENCY=1000;
export const findURLS = async (page: Page, controller:WebsiteController): Promise<void> => {
   
    await page.goto(controller.initialUrl());
    await page.waitForTimeout(5000);

    const visitedUrls:Record<string,number|null>={};
    const urlsToReturn:Record<string,1>={};
    const initialUrl=controller.initialUrl();
    const maxDepth=controller.maxDepth();
    visitedUrls[initialUrl]=0
    let counter=0;
    let currUrl:string|undefined=initialUrl;
    do{
        await page.waitForTimeout(250);
        if((await controller.requireUserAttention(page))){
            continue
        }
        console.log("starting to find next url")
        currUrl=Object.keys(visitedUrls).find(url=>  visitedUrls[url]!==null && visitedUrls[url]!==undefined && visitedUrls[url]<maxDepth);
        console.log("found next url:", currUrl);
        if(!currUrl){
            break;
        }
        visitedUrls[currUrl]=null;
        console.log("going to url")

        await page.goto(currUrl,{waitUntil:"domcontentloaded"});
        console.log("finished going to url")
        const currDepth=visitedUrls[currUrl]!;
        const links = await page.evaluate(()=>{
            return Array.from(document.querySelectorAll('a')).map(link=>link.getAttribute('href')).filter(href=>href!==null && href!==undefined);
        });
        console.log("starting iteration")
        for(const link of links){
            let href = link;
            if(href && !href.startsWith("http")){
                href=join(controller.parentDomain(),href,"/");
            }
            if(href && visitedUrls[href]===undefined && controller.canBeVisited(href)){
               visitedUrls[href]=currDepth+1;
            }
            if(href && controller.canBeReturned(href)){
                urlsToReturn[href]=1;
            }
            counter++;
            if(counter%SAVE_FREQUENCY===0){
                const extractedUrls:ExtractedUrls={
                    name:controller.initialUrl(),
                    urlsToVisit:visitedUrls,
                    urlsToReturn:Object.keys(urlsToReturn)
                };
            
                const outputPath=path.join("/home/compf/data/linkrandomizer/packages/common/src/models/data/extracted-urls",controller.name()+".json");
                console.log("starting to save")
                fs.writeFileSync(outputPath, JSON.stringify(extractedUrls, null, 2));
                console.log("finished saving")
            }
        }
        console.log("finished iteration")
        sendToControlWindow('webSiteAnalysisStateChanged',Object.keys(visitedUrls).filter(url=>controller.canBeReturned(url)).length);
    }while(currUrl);

   

   
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

