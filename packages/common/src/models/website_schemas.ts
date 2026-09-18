import {z} from 'zod';
import { GeneratedURL } from './generated_url.js';
import {
    DatePeriod,
    constrainRangeValue,
    dateMatchesPeriod,
    daysInMonth,
    extractDateFromString,
    extractDateFromVariables,
    isDayVariableName,
    isMonthVariableName,
    isYearVariableName,
    monthNameForValues,
    periodIsEmpty,
    randomInt,
} from './date-period.js';
import { websiteCoverage } from './url-period.js';


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
    version:z.number().optional(),
    displayName:z.string().optional().nullable().describe("Human-readable site name shown in the explorer"),
    summary:z.string().optional().nullable().describe("One-line description of what a generated URL points to"),
    schema:z.array(URLPartSchema).describe("Alternating between fixed string parts and variable parts. The first part must be fixed and start with http or https"),
    tags:z.array(z.string()).describe("Tags to categorize the website"),
    variables:z.array(z.union([RandomFromRangeSchema,RandomDateSchema,RandomFromSelectionSchema,RandomDateRangeSchema])),
    prompt:(z.string()).optional().nullable().describe(`
        Optional prompt to instruct another  AI to explain the context, content and importance of an URL. For instance, for a newspaper what happened on that day? For a scientific paper, what is the abstract and main findings? For a social media post, what is the content and who is the author?
       
        `,),
 


openIn:z.enum(["firefox","chromium","playwrightBrowser"]).optional().nullable().describe("Whether the URL should be opened in the default browser or in a playwright controlled browser. The default browser is useful for websites that require login."),
downloadType:z.enum(["downloadFromGeneratedURL","downloadFromURLInClipboard","screenshotInClipboard",]),
obtainMoreVariablesFunction:z.function({
    input: z.tuple([z.record(z.string(), z.unknown())]), // Argumente der Funktion
    output: z.void(),                       // Rückgabetyp der Funktion
  })
  .optional().nullable().describe("Function to obtain more variables from the website. The function should add variables to the variables record."),
},


)



export const RandomURLPartSchema=z.union([RandomFromRangeSchema,RandomDateRangeSchema,RandomDateSchema,RandomFromSelectionSchema])
export type RandomURLPart=z.infer<typeof RandomURLPartSchema>

export type RandomFromRange=z.infer<typeof RandomFromRangeSchema>
export type RandomDate=z.infer<typeof RandomDateSchema>
export type RandomFromSelection=z.infer<typeof RandomFromSelectionSchema>
export type RandomDateRange=z.infer<typeof RandomDateRangeSchema>

class PeriodUnsatisfiableError extends Error {
    constructor() {
        super("Could not generate a URL for the requested period");
        this.name = "PeriodUnsatisfiableError";
    }
}

const pickDateParts = (
    minYear: number,
    maxYearExclusive: number,
    period?: DatePeriod,
): { year: number; month: number; day: number } => {
    const year = constrainRangeValue(minYear, maxYearExclusive, period?.year);
    const month = period?.month !== undefined && period.month >= 1 && period.month <= 12
        ? period.month
        : randomInt(1, 13);
    const day = randomInt(1, daysInMonth(year, month) + 1);
    return { year, month, day };
};

const pickFromUrlPool = (values: string[], period?: DatePeriod): string => {
    if (values.length === 0) {
        throw new PeriodUnsatisfiableError();
    }
    if (periodIsEmpty(period)) {
        return values[Math.floor(Math.random() * values.length)];
    }
    const dated = values.filter((value) => extractDateFromString(value).year !== undefined);
    if (dated.length === 0) {
        return values[Math.floor(Math.random() * values.length)];
    }
    const matching = dated.filter((value) => dateMatchesPeriod(extractDateFromString(value), period));
    if (matching.length === 0) {
        throw new PeriodUnsatisfiableError();
    }
    return matching[Math.floor(Math.random() * matching.length)];
};

const executeRec=(randomURLPart:RandomURLPart,variables:Record<string,unknown>, period?: DatePeriod)=>{

        if(randomURLPart.name==="randomFromRange"){
            const randRange=randomURLPart as RandomFromRange
            if (isYearVariableName(randRange.variableName)) {
                variables[randRange.variableName]=constrainRangeValue(
                    randRange.min,
                    randRange.maxExclusive,
                    period?.year,
                )
            } else if (isMonthVariableName(randRange.variableName)) {
                variables[randRange.variableName]=constrainRangeValue(
                    randRange.min,
                    randRange.maxExclusive,
                    period?.month,
                )
            } else if (isDayVariableName(randRange.variableName)) {
                const year = Number(variables.year ?? variables.year1)
                const month = Number(variables.month ?? variables.month1)
                let maxExclusive = randRange.maxExclusive
                if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
                    maxExclusive = Math.min(maxExclusive, daysInMonth(year, month) + 1)
                }
                variables[randRange.variableName]=constrainRangeValue(randRange.min, maxExclusive)
            } else {
                variables[randRange.variableName]=constrainRangeValue(randRange.min, randRange.maxExclusive)
            }
        }
        else if(randomURLPart.name==="randomDate"){
            const randDate=randomURLPart as RandomDate
            const { year, month, day } = pickDateParts(randDate.minYear, randDate.maxYearExclusive, period)
            variables["year"]=year
            variables["month"]=month
            variables["day"]=day
        }
        else if(randomURLPart.name==="randomDateRange"){
            const randDate=randomURLPart as RandomDateRange
            const { year, month, day } = pickDateParts(randDate.minYear, randDate.maxYearExclusive, period)
            const start = new Date(year, month - 1, day)
            const addDays=Math.floor(Math.random()*randomURLPart.maxNumberOfDaysToSecondDate)
            const dt2=new Date(start.getTime()+addDays*24*60*60*1000)

            variables["year1"]=year
            variables["month1"]=month
            variables["day1"]=day
            variables["year2"]=dt2.getFullYear()
            variables["month2"]=dt2.getMonth()+1
            variables["day2"]=dt2.getDate()
        }
        else if(randomURLPart.name==="randomFromSelection"){
            const randSelection=randomURLPart as RandomFromSelection
            if (isMonthVariableName(randSelection.variableName) && period?.month !== undefined) {
                const named = monthNameForValues(period.month, randSelection.values)
                if (named) {
                    variables[randSelection.variableName]=named
                    return
                }
            }
            const looksLikeUrls = randSelection.values.some((value) => /^https?:\/\//.test(value) || value.includes("/"))
            if (looksLikeUrls && !periodIsEmpty(period)) {
                variables[randSelection.variableName]=pickFromUrlPool(randSelection.values, period)
            } else if (randSelection.values.length === 0) {
                variables[randSelection.variableName]=""
            } else {
                variables[randSelection.variableName]=randSelection.values[Math.floor(Math.random()*randSelection.values.length)]
            }
        }
        

}

const stitchUrl = (website: Website, variables: Record<string, unknown>): string => {
    let url=""

    for(const schema of website.schema){
        if(typeof schema=="string"){
            url+=schema
        }
        else{

            let v=variables[schema.variable]
            if(!v && v !== 0){
                console.log("Variable "+schema.variable+" not found in variables:"+JSON.stringify(variables)+JSON.stringify(website))
            }
               const asString=v+""

            if(schema.padding){
               url+=asString.padStart(schema.padding,"0")
                
            }
            else{
                url+=asString
            }
        }
    }
    return url
}

const generateOnce = (website: Website, period?: DatePeriod): GeneratedURL => {
    const variables:Record<string,unknown>={}
    
    for(const variable of website.variables){
        executeRec(variable, variables, period)
    }
    
    const url = stitchUrl(website, variables)
    if(website.obtainMoreVariablesFunction){
        website.obtainMoreVariablesFunction(variables)
    }
    return {
        url,
        variables,
        website
    }
}

export type Website=z.infer<typeof WebsiteSchema>

export const generateRandomURL=(website:Website, period?: DatePeriod):GeneratedURL=>{
    const generated = tryGenerateRandomURL(website, period)
    if (!generated) {
        throw new PeriodUnsatisfiableError()
    }
    return generated
}

export const tryGenerateRandomURL=(website:Website, period?: DatePeriod):GeneratedURL | null=>{
    const emptyPeriod = periodIsEmpty(period)
    if (!emptyPeriod && !websiteCoverage(website).hasDate) {
        return null
    }
    const attempts = website.obtainMoreVariablesFunction && !emptyPeriod ? 50 : emptyPeriod ? 1 : 12
    for (let i = 0; i < attempts; i++) {
        try {
            const generated = generateOnce(website, period)
            if (emptyPeriod) {
                return generated
            }
            const date = extractDateFromVariables(generated.variables, generated.url)
            if (date.year === undefined && !website.obtainMoreVariablesFunction) {
                const poolHasDates = website.variables.some((variable) =>
                    variable.name === "randomFromSelection" &&
                    variable.values.some((value) => extractDateFromString(value).year !== undefined)
                )
                if (!poolHasDates) {
                    return generated
                }
                continue
            }
            if (dateMatchesPeriod(date, period)) {
                return generated
            }
        } catch (error) {
            if (error instanceof PeriodUnsatisfiableError) {
                return null
            }
            throw error
        }
    }
    return null
}

export const generateUrlBatch = (
    website: Website,
    count: number,
    period?: DatePeriod,
): GeneratedURL[] => {
    const urls: GeneratedURL[] = []
    for (let i = 0; i < count; i++) {
        const generated = tryGenerateRandomURL(website, period)
        if (!generated) {
            break
        }
        urls.push(generated)
    }
    return urls
}

export const getTagsForWebsites=(websites:Website[]):string[]=>{
    const tagSet=new Set<string>()
    for(const website of websites){
        for(const tag of website.tags){
            tagSet.add(tag)
        }
    }
    return Array.from(tagSet)
}
