import type { Page } from "playwright"
import { z } from "zod"
export const GotoActionSchema=z.object({
    actionType:z.literal("goto"),
    url:z.string(),
})

export const ClickActionSchema=z.object({
    actionType:z.literal("click"),
    selector:z.string(),
})

export const FillActionSchema=z.object({
    actionType:z.literal("fill"),
    selector:z.string(),
    text:z.string(),
})

export const GetLinksActionSchema=z.object({
    actionType:z.literal("getLinks"),
})
export type GetLinksAction=z.infer<typeof GetLinksActionSchema>

export const WaitForSelectorActionSchema=z.object({
    actionType:z.literal("waitForSelector"),
    selector:z.string(),
    timeout:z.number().optional().nullable(),
})

export const GetPageContentActionSchema=z.object({
    actionType:z.literal("getPageContent"),
})

export const BrowserActionSchema=z.union([GotoActionSchema,ClickActionSchema,FillActionSchema,GetLinksActionSchema,WaitForSelectorActionSchema,GetPageContentActionSchema])



export type BrowserAction=z.infer<typeof BrowserActionSchema>
export const executeBrowserAction = async (action: BrowserAction, page: Page, output:string[]): Promise<string[]> => {
    try{
    switch (action.actionType) {
        case "goto":
            await page.goto(action.url);
            output.push(`Navigated to ${action.url}`);
            return []
        case 'click':
            await page.click(action.selector);
            output.push(`Clicked on ${action.selector}`);
            return []
        case 'fill':
             await page.fill(action.selector, action.text);
                output.push(`Filled ${action.selector} with ${action.text}`);
             return []
        case 'getLinks':
            const tags=  (await page.locator('xpath=//a').all())
            const links=(await Promise.all(tags.map(async (t)=>await t.getAttribute('href')))).filter((l)=>l!=null);
            console.log("Extracted links:", links)
                output.push(`Extracted the following links:\n \n ${links.join("\n")}`);
            return links
        case 'waitForSelector':
             await page.waitForSelector(action.selector, { timeout: action.timeout ?? 5000 });
                output.push(`Waited for selector ${action.selector} to appear`);
             return []
        case 'getPageContent':
            const content = await page.content();
                output.push(`Got page content:\n\n ${content}`);
            return  [content];
        default:
            throw new Error(`Unknown action type: ${(action as any).actionType}`);
    }
}
    catch(e){
        output.push(`Error executing action ${action.actionType}: ${(e as Error).message}`);
        return []
    }

}