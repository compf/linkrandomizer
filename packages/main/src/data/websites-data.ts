import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { Website } from '@linkrandomizer/common';
import {publicWebsites} from "./public-websites.js"

// Sample websites for demonstration



const getWebsitesFilePath = (): string => {
    return path.join(app.getPath('userData'), 'websites.json');
};
export const updateWebsites = (websites: Website[]) => {
    allWebsites.length=0;
    allWebsites.push(...websites)
    saveWebsites();
}

export const saveWebsites = (): void => {
    try {
        const filePath = getWebsitesFilePath();
        fs.writeFileSync(filePath, JSON.stringify(allWebsites, null, 2));
        console.log('Websites saved to:', filePath);
    } catch (error) {
        console.error('Error saving websites:', error);
    }
};
export const allWebsites:Website[]=[]

export const loadWebsites = async (): Promise<void> => {
    const sources:Website[][] = [];
    sources.push(publicWebsites);
    try{
        //ts-ignore
        const otherWebsites=await import("./internal-websites.js")
        console.log("Loaded internal websites:", otherWebsites.internalWebsites);
        sources.push(otherWebsites.internalWebsites)
    }
    catch{

    }

    const target:Record<string,Website>={}

    for(const source of sources){
        for(const website of source){
            if(!target[website.name]){
                target[website.name] = website;
            }
            else{
               const compareWebsite=target[website.name]!
               console.log(compareWebsite,website)
               if(compareWebsite.version && website.version){
                if(website.version>compareWebsite.version){
                    target[website.name]=website
                }
               }
               
            }
        }

    }
    allWebsites.push(...Object.values(target))
    console.log('Websites loaded. Total unique websites count:', allWebsites.length);
     
    
};

export const addWebsite = (website: Website): void => {
   if(allWebsites.find(w=>w.name===website.name)){
    console.warn(`Website with name ${website.name} already exists. Skipping add.`);
    return;
   }
   allWebsites.push(website);
   saveWebsites();
};

