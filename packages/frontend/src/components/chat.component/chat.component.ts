import { Component, inject, signal } from "@angular/core";
import { FormControl, FormsModule } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { GeneratedURL } from "@linkrandomizer/common";
import { ChatHistory } from "@linkrandomizer/common"
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner'; 
import showdown from "showdown";
const converter = new showdown.Converter();
@Component({
    selector: 'app-chat',
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.css'],
    imports: [
        MatDialogModule,
        FormsModule,
        MatIconModule,
        MatProgressSpinnerModule
    ]
})
export class ChatDialogComponent {
    public data=inject(MAT_DIALOG_DATA) as  GeneratedURL;

    public loading=signal(false);
    

    protected messages=signal<ChatHistory>([
       
       

    ])
    constructor(){
        console.log("ChatDialogComponent initialized with data:", this.data);
        if(this.data.website.prompt){
            this.messages.update(msgs=>[...msgs,{content:{type:"text", text:this.data.website.prompt!!, image:undefined}, sender:"assistant"}])
        }
        window.api.eventFromBackend.onContentLoaded(undefined,(data)=>{
            console.log("Clipboard updated:", data);
            const newMessage={
                content:data,
                sender:"user" as "user"
            }
            this.messages.update(msgs=>[...msgs,newMessage])
            this.loading.set(false);
        })
    }

    protected userInput=signal("")
    
    async sendMessage(){
        const newMessage={
            content:{
                type:"text" as "text",
                text:this.userInput(),
                image:undefined
            },
            sender:"user" as "user"
        }
        const msgs=this.messages();
        if(newMessage.content.text.trim()!==""){
            this.messages.update(msgs=>[...msgs,newMessage])
        }
        this.loading.set(true);
          this.userInput.set("");
        const response = await window.api.invokeFromBackend.explainUrl({url:this.data, messages:this.messages()});
        this.loading.set(false);
        const chatResponse={
            content:{
                type:"text" as "text",
                text:converter.makeHtml(response),
                image:undefined
            },
            sender:"assistant" as "assistant"
        }
      
        this.messages.update(msgs=>[...msgs,chatResponse])
    }
    private getBase64(arrayBuffer: ArrayBufferLike): string {
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return "data:image/png;base64,"+window.btoa(binary);
    }

    openUrl(){
        window.api.sendToBackend.openUrlInBrowser({url:this.data.url})
    }
    
    addgeneratedUrl(){
        this.loading.set(true);
      window.api.sendToBackend.obtainUrlContent({
          generatedURL:this.data,
          type:"downloadFromGeneratedURL"
      })
    }
    addClipboard(){
        this.loading.set(true);

        window.api.sendToBackend.obtainUrlContent({
            generatedURL:this.data,
            type:"downloadFromURLInClipboard"
        })
    }
    addClipboardImage(){
        this.loading.set(true);

        window.api.sendToBackend.obtainUrlContent({
            generatedURL:this.data,
            type:"screenshotInClipboard"
        })    
    }
}