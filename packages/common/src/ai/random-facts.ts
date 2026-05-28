import { post } from "./ai-agent.js"

export const getRandomFacts=async(topic:string, count:number):Promise<string[]>=>{
    const facts=await post([{
        role:"user",
        content:`Generate ${count} random facts/trivia or other interesting information about the following topic:
         
        ${topic}

         These facts should be interesting and not obvious for someone who knows the topic.
         
         Return the facts in a JSON array of strings. Do not add any other text except the JSON array.
         `
    }])
    const factsExtracted=facts.replace(/```json/g, "").replace(/```/g, "")
    return JSON.parse(factsExtracted) as string[]
}