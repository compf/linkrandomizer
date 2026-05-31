import { ChatCompletionMessageParam } from "openai/resources/chat/completions/index.js"

export const post=async(messages:ChatCompletionMessageParam[]):Promise<string>=>{
    const body={
        model:"gpt-4o",
        messages:messages,
        max_completion_tokens:16_000,
    }
    const key=await (window as any).api.invokeFromBackend.getKey();
    const response=await fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Bearer "+key
        },
        body:JSON.stringify(body)
    })
    const data=await response.json()
    console.log("OpenAI response:", data);
    try{
        return data.choices[0].message.content
    }
    catch(error){
        console.error("Error parsing OpenAI response:", error, response);
        return "Error parsing OpenAI response: "+error+". Response: "+JSON.stringify(response);
    }
}