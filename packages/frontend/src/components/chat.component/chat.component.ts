import { Component, inject, signal } from "@angular/core";
import { FormControl, FormsModule } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { GeneratedURL } from "@linkrandomizer/common";
@Component({
    selector: 'app-chat',
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.css'],
    imports: [
        MatDialogModule,
        FormsModule
    ]
})
export class ChatDialogComponent {
    public data=inject(MAT_DIALOG_DATA) as  GeneratedURL;
    

    protected messages=signal<{text:string, sender:"user"|"assistant"}[]>([
        {
            text:"Hello! I'm your assistant. How can I help you today?",
            sender:"assistant"
        },
        {
            text:"Hi! I want to analyze a website and generate some random URLs based on it.",
            sender:"user"
        }

    ])
    constructor(){
        console.log("ChatDialogComponent initialized with URL:", this.data);
    }

    protected userInput=signal("")
    
    async sendMessage(){
        this.messages.update(msgs=>[...msgs,{text:this.userInput(),sender:"user"}])
        const response = await window.api.invokeFromBackend.explainUrl({url:this.data, messages:this.messages()});
        this.messages.update(msgs=>[...msgs,{text:response, sender:"assistant"}])
        this.userInput.set("");
    }
}