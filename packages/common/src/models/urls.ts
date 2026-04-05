import {z} from 'zod';


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
    suffix:z.string().nullable().optional().describe("optional suffix to distinguish variables (e.g. year1, year2)")
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
    variables:z.array(z.union([RandomFromRangeSchema,RandomDateSchema,RandomFromSelectionSchema]))
})
export const RandomURLPartSchema=z.union([RandomFromRangeSchema,RandomDateSchema,RandomFromSelectionSchema])
export type RandomURLPart=z.infer<typeof RandomURLPartSchema>

export type RandomFromRange=z.infer<typeof RandomFromRangeSchema>
export type RandomDate=z.infer<typeof RandomDateSchema>
export type RandomFromSelection=z.infer<typeof RandomFromSelectionSchema>




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
            const suffix=randDate.suffix??""
            variables["year"+suffix]=year
            variables["month"+suffix]=month
            variables["day"+suffix]=day
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


export const generateRandomURL=(website:Website)=>{
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
               url+=asString.padStart(schema.padding)
                
            }
            else{
                url+=asString
            }
        }
    }
    return url
}