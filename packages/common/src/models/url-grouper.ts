import { ur } from "zod/v4/locales"
import { GeneratedURL } from "./generated_url.js"

export type GroupedURl={
    groupKey:string,
    groupValue:string,
    children:GroupedURl[] | null,
    urls:GeneratedURL[]
}
export interface UrlGrouper {

    group(urls: GeneratedURL[]): GroupedURl
}

export class NoGrouping implements UrlGrouper {
    group(urls: GeneratedURL[]): GroupedURl {
        return {
            groupKey: "",
            groupValue: "All URLs",
            children: null,
            urls
        }
    }
}

export class  GroupByVariables implements UrlGrouper {

    constructor(private relevantKeys:string[]) {}

    private findOrCreateGroupRec(groupedURL: GroupedURl,  values: string[],variables:string[],depth:number, url: GeneratedURL){
        const relevantValue=values[depth]
        const relevantVariable=variables[depth]
        let child=groupedURL.children?.find(c=>c.groupKey===relevantVariable && c.groupValue===relevantValue)
        if(!child){
            child={
                groupKey: relevantVariable,
                groupValue: relevantValue,
                children: [],
                urls: []
            }
            if(!groupedURL.children) groupedURL.children=[];
            groupedURL.children.push(child)
        }
        if(depth>=values.length-1){
            child.urls.push(url)
        }else{
            this.findOrCreateGroupRec(child, values, variables, depth+1, url)
        }
    }

    
    group(urls: GeneratedURL[]): GroupedURl {

        const variableNames=Array.from(new Set(urls.flatMap(u=>Object.keys(u.variables)))).filter((it)=>this.relevantKeys.includes(it)).sort((a,b)=>this.relevantKeys.indexOf(a)-this.relevantKeys.indexOf(b));
       const res: GroupedURl ={
            groupKey: "",
            groupValue: "All URLs",
            children:[],
            urls:[]
        }

        for(const url of urls){
         const values=variableNames.map((it)=>url.variables[it]).filter(v=>v!==undefined).map(v=>v+"")
        this.findOrCreateGroupRec(res, values, variableNames.filter((v)=>url.variables[v]!==undefined), 0, url)
        }
        return res;
       
    }
}