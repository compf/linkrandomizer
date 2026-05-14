import type { Website } from "@linkrandomizer/common";

export let publicWebsites: Website[] = [
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

        ],
        downloadType:"screenshotInClipboard",
    
    
    }
   
];