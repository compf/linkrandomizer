import {z} from 'zod';
import { GeneratedURL } from './generated_url.js';


export const RandomFromRangeSchema=z.object({
    name:z.literal("randomFromRange"),
    min:z.number(),
    suffix:z.string().nullable().optional().describe("optional suffix to distinguish variables (e.g. page1, page2)"),
    maxExclusive:z.number(),
    variableName:z.string()
})

export const RandomDateSchema=z.object({
    name:z.literal("randomDate"),
    minYear:z.number(),
    maxYearExclusive:z.number(),
})

export const RandomDateRangeSchema=z.object({
    name:z.literal("randomDateRange"),
    minYear:z.number(),
    maxYearExclusive:z.number(),
    maxNumberOfDaysToSecondDate:z.number().describe("max number of days to add to the start date to get the end date")
})

export const RandomFromSelectionSchema=z.object({
    name:z.literal("randomFromSelection"),
    values:z.array(z.string()),
    variableName:z.string()
})
export const URLPartSchema=z.union([z.string(),z.object({variable:z.string(),padding:z.number().nullable()})])


export const WebsiteSchema=z.object({
    name:z.string().describe("unique Name of the website schema"),
    schema:z.array(URLPartSchema).describe("Alternating between fixed string parts and variable parts. The first part must be fixed and start with http or https"),
    tags:z.array(z.string()).describe("Tags to categorize the website"),
    variables:z.array(z.union([RandomFromRangeSchema,RandomDateSchema,RandomFromSelectionSchema,RandomDateRangeSchema])),
    prompts:z.array(z.string()).optional().describe(`
        Optional prompts to instruct the AI to explain the context, content and importance of an URL.
        The prompt should  give an overview, outline anything that is interesting about the content of the URL.
        For German text, the prompt should be in German and instruct the AI  to reply in German.
        For all other languages, the prompt should be in English and instruct the AI to reply in English regardless of the language used.
        `
),
openIn:z.enum(["defaultBrowser","playwrightBrowser"]).optional().describe("Whether the URL should be opened in the default browser or in a playwright controlled browser. The default browser is useful for websites that require login."),
urlType:z.enum(["html","pdf","embedded"]).optional().describe("The type of the URL content. use embedded if an pdf is embedded in an html page without providing a direct link to the pdf. "),

},


)



export const RandomURLPartSchema=z.union([RandomFromRangeSchema,RandomDateRangeSchema,RandomDateSchema,RandomFromSelectionSchema])
export type RandomURLPart=z.infer<typeof RandomURLPartSchema>

export type RandomFromRange=z.infer<typeof RandomFromRangeSchema>
export type RandomDate=z.infer<typeof RandomDateSchema>
export type RandomFromSelection=z.infer<typeof RandomFromSelectionSchema>
export type RandomDateRange=z.infer<typeof RandomDateRangeSchema>




const executeRec=(randomURLPart:RandomURLPart,variables:Record<string,unknown>)=>{

        if(randomURLPart.name==="randomFromRange"){
            const randRange=randomURLPart as RandomFromRange
            const rnd=randRange.min+Math.random()*(randRange.maxExclusive-randRange.min)
            variables[randRange.variableName]=Math.floor(rnd)
        }
        else if(randomURLPart.name==="randomDate"){
            const randDate=randomURLPart as RandomDate
            let year=randDate.minYear+Math.random()*(randDate.maxYearExclusive-randDate.minYear)
            let month=1+Math.random()*12;
            let day=1+Math.random()*32;
            const dt=new Date(year,month,day)

            year=dt.getFullYear()
            month=dt.getMonth()+1
            day=dt.getDate()
            const suffix=""
            variables["year"+suffix]=year
            variables["month"+suffix]=month
            variables["day"+suffix]=day
        }
        else if(randomURLPart.name==="randomDateRange"){
            const randDate=randomURLPart as RandomDateRange

             let year=randDate.minYear+Math.random()*(randDate.maxYearExclusive-randDate.minYear)
            let month=1+Math.random()*12;
            let day=1+Math.random()*32;
            const dt=new Date(year,month,day)

            year=dt.getFullYear()
            month=dt.getMonth()+1
            day=dt.getDate()

            const addDays=Math.floor(Math.random()*randomURLPart.maxNumberOfDaysToSecondDate)
            const dt2=new Date(dt.getTime()+addDays*24*60*60*1000)

            const suffix1="1"
            const suffix2="2"
            variables["year"+suffix1]=year
            variables["month"+suffix1]=month
            variables["day"+suffix1]=day

            variables["year"+suffix2]=dt2.getFullYear()
            variables["month"+suffix2]=dt2.getMonth()+1
            variables["day"+suffix2]=dt2.getDate()

        }
        else if(randomURLPart.name==="randomFromSelection"){
            const randSelection=randomURLPart as RandomFromSelection
            const rnd=randSelection.values[Math.floor(Math.random()*randSelection.values.length)]
            variables[randSelection.variableName]=rnd
        }
        

}

export const VariableFormattingSchema=z.union([z.string(),z.object({variable:z.string(),padding:z.number().nullable()})])
export type VariableFormatting=z.infer<typeof VariableFormattingSchema>

export type Website=z.infer<typeof WebsiteSchema>


export const generateRandomURL=(website:Website):GeneratedURL=>{
    const variables:Record<string,unknown>={}
    
    // Execute all variable generation
    for(const variable of website.variables){
        executeRec(variable, variables)
    }
    
    let url=""

    for(const schema of website.schema){
        if(typeof schema=="string"){
            url+=schema
        }
        else{

            let v=variables[schema.variable]
               const asString=v+""

            if(schema.padding){
               url+=asString.padStart(schema.padding,"0")
                
            }
            else{
                url+=asString
            }
        }
    }
    return {
        url,
        variables,
        website
    }
}