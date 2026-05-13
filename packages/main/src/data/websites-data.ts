import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { Website } from '@linkrandomizer/common';


// Sample websites for demonstration
let publicWebsites: Website[] = [
    {
        name:"nytimes time machine",
        tags:["news","articles"],
        //https://timesmachine.nytimes.com/timesmachine/1992/11/05/issue.html
        schema:["https://timesmachine.nytimes.com/timesmachine/",{variable:"year",padding:null},"/",{variable:"month",padding:2},"/",{variable:"day",padding:2},"/issue.html"],
        variables:[
            {
                name:"randomDate",
                minYear:1860,
                maxYearExclusive:2003,
            }

        ]
    }
   
];
const otherWebssites: Website[] = []


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
    const filePath = getWebsitesFilePath();
    if(fs.existsSync(filePath)){
        const data = fs.readFileSync(filePath, 'utf-8');
        const loadedWebsites: Website[] = JSON.parse(data);
        sources.push(loadedWebsites);
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

