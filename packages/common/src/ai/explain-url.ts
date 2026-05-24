import { ChatCompletionAssistantMessageParam, ChatCompletionContentPart, ChatCompletionMessageParam, ChatCompletionUserMessageParam } from "openai/resources";
import { ChatHistory, ChatMessage, GeneratedURL } from "../index.js";
import openai from "openai";
import { post } from "./ai-agent.js";

const transformBufferToBase64 = (imageBuffer: ArrayBufferLike): string => {
    
        var binary = '';
        var bytes = new Uint8Array( imageBuffer );
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode( bytes[ i ] );
        }
        return window.btoa( binary );
    

}

export const explainURL = async (
    url: GeneratedURL,
    messages: ChatHistory
): Promise<string> => {
   console.log("Explaining URL with OpenAI. URL:", url, "Messages:", messages);
   const transformMessage=(message:ChatMessage):string|ChatCompletionContentPart[]=>{
    if(message.type==="text"){
       return message.text ??""
    }
    else if(message.type==="image"){
        return [
            {
                type:"image_url",
                image_url:{
                    url:message.image ? `data:image/png;base64,${transformBufferToBase64(message.image)}` : ""
                }
            }
        ]
       
    }
    else if(message.type==="file"){
        return[
            {
                type:"file",

                file:{
                    filename:"file",
                    file_data:"data:application/pdf;base64,"+transformBufferToBase64(message.file?.data || new ArrayBuffer(0))


                }
            }
        ]
    }
    return ""
}
 

    const messagesTransformed: ChatCompletionMessageParam[] = messages.map(msg => {
        if (msg.sender === "assistant") {
            return {
                role: "assistant",
                content: msg.content.type === "text" ? (msg.content.text || "") : "[image]"
            } as ChatCompletionAssistantMessageParam;
        } else {
            return {
                role: "user",
                content: transformMessage(msg.content)
                
            } as ChatCompletionUserMessageParam;
        }
    });
    console.log("Transformed messages for OpenAI:", messagesTransformed);

   
    const response = await post(messagesTransformed);

    return response;





};

