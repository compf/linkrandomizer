import { ur } from "zod/v4/locales"
import { GeneratedURL } from "./generated_url.js"

export type GroupedURl = {
    groupKey: string,
    groupValue: string,
    children: GroupedURl[] | null,
    urls: GeneratedURL[]
}
export type GrouperName = "No grouping" | "Group by variables" |
    "Group by tags"
export interface UrlGrouper {

    group(urls: GeneratedURL[]): GroupedURl
    getName(): GrouperName
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
    getName(): GrouperName {
        return "No grouping"
    }
}

export class GroupByVariables implements UrlGrouper {

    protected getRelevantKeys(): string[] {
        return ["year", "month"]
    }

    constructor() { }

    private findOrCreateGroupRec(groupedURL: GroupedURl, values: string[], variables: string[], depth: number, url: GeneratedURL) {
        const relevantValue = values[depth]
        const relevantVariable = variables[depth]
        let child = groupedURL.children?.find(c => c.groupKey === relevantVariable && c.groupValue === relevantValue)
        if (!child) {
            child = {
                groupKey: relevantVariable,
                groupValue: relevantValue,
                children: [],
                urls: []
            }
            if (!groupedURL.children) groupedURL.children = [];
            groupedURL.children.push(child)
        }
        if (depth >= values.length - 1) {
            child.urls.push(url)
        } else {
            this.findOrCreateGroupRec(child, values, variables, depth + 1, url)
        }
    }

    getName(): GrouperName {
        return "Group by variables"
    }


    group(urls: GeneratedURL[]): GroupedURl {
        const relevantKeys = this.getRelevantKeys();

        const variableNames = Array.from(new Set(urls.flatMap(u => Object.keys(u.variables)))).filter((it) => relevantKeys.includes(it)).sort((a, b) => relevantKeys.indexOf(a) - relevantKeys.indexOf(b));
        const res: GroupedURl = {
            groupKey: "",
            groupValue: "All URLs",
            children: [],
            urls: []
        }

        for (const url of urls) {
            const values = variableNames.map((it) => url.variables[it]).filter(v => v !== undefined).map(v => v + "")
            this.findOrCreateGroupRec(res, values, variableNames.filter((v) => url.variables[v] !== undefined), 0, url)
        }
        return res;

    }
}

export class GroupByTags implements UrlGrouper {
    getName(): GrouperName {
        return "Group by tags"
    }
    group(urls: GeneratedURL[]): GroupedURl {
        const res: GroupedURl = {
            groupKey: "",
            groupValue: "All URLs",
            children: [],
            urls: []
        }
        for (const url of urls) {
            for (const tag of url.website.tags) {
                let child = res.children?.find(c => c.groupKey === "tag" && c.groupValue === tag)
                if (!child) {
                    child = {
                        groupKey: "tag",
                        groupValue: tag,
                        children: [],
                        urls: []
                    }
                    res.children?.push(child)
                }
                child.urls.push(url)
            }
        }
        return res;
    }

}


export const availableGroupers: Record<GrouperName, UrlGrouper> = {
    "No grouping": new NoGrouping(),
    "Group by variables": new GroupByVariables(),
    "Group by tags": new GroupByTags()
}