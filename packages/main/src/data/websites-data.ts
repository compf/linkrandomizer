import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { Website } from '@linkrandomizer/common';
// Sample websites for demonstration
let sampleWebsites: Website[] = [
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

const getWebsitesFilePath = (): string => {
    return path.join(app.getPath('userData'), 'websites.json');
};

const saveWebsites = (): void => {
    try {
        const filePath = getWebsitesFilePath();
        fs.writeFileSync(filePath, JSON.stringify(sampleWebsites, null, 2));
        console.log('Websites saved to:', filePath);
    } catch (error) {
        console.error('Error saving websites:', error);
    }
};

const loadWebsites = (): void => {
    try {
        const filePath = getWebsitesFilePath();
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            const loadedWebsites: Website[] = JSON.parse(data);
            // Merge loaded websites with sample websites, avoiding duplicates by name
            const existingNames = new Set(sampleWebsites.map(w => w.name));
            const newWebsites = loadedWebsites.filter(w => !existingNames.has(w.name));
            sampleWebsites = [...sampleWebsites, ...newWebsites];
            console.log('Websites loaded from:', filePath, 'added', newWebsites.length, 'new websites');
        } else {
            console.log('No saved websites file found, using defaults');
        }
    } catch (error) {
        console.error('Error loading websites:', error);
    }
};

const addWebsite = (website: Website): void => {
    const existingNames = new Set(sampleWebsites.map(w => w.name));
    if (!existingNames.has(website.name)) {
        sampleWebsites = [...sampleWebsites, website];
        console.log('Added new website to collection:', website.name);
    }
};

export { sampleWebsites, saveWebsites, loadWebsites, addWebsite };