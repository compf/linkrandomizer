import { clipboard } from "electron";
import { sendToControlWindow } from "../mainBackend.js";
import { UrlHandler } from "../handlers/url-handler.js";
import fs from "fs";
import path from "path";
export interface SystemWater{
    update(notifyFrontend:boolean):void;
}
export class ClipBoardWatcher implements SystemWater{

    private previousClipBoardBase64: string | null = null;
    private previousClipBoardText: string | null = null;

    public update(notifyFrontend:boolean): void {
        const availableFormats = clipboard.availableFormats()
        if (availableFormats.length > 0) {
            if (availableFormats.includes("text/plain")) {
                const text = clipboard.readText()
                if (text === this.previousClipBoardText) {
                    return;
                }
                this.previousClipBoardText = text;
                if(notifyFrontend){
                    UrlHandler.eventFromBackend.onSystemStateUpdate({ type: "text", text, image: undefined })
                }
            }
            else if (availableFormats.includes("image/png")) {
                const image = clipboard.readImage().toPNG()
                const base64Image = Buffer.from(image).toString('base64');
                if (base64Image === this.previousClipBoardBase64) {
                    return;
                }
                this.previousClipBoardBase64 = base64Image;
                if(notifyFrontend){
                UrlHandler.eventFromBackend.onSystemStateUpdate({ type: "image", text: undefined, image: image.buffer })
                }
            }

        }
    }
}

export class FileSystemWatcher implements SystemWater{
    private previousFiles:string[]=[]
    update(notifyFrontend:boolean): void {
        const files=fs.readdirSync(this.basePath)
        if(this.previousFiles.length!==files.length){
            for(const file of files){
                const isFile=fs.statSync(path.join(this.basePath,file)).isFile();
                if(!isFile){
                    continue;
                }
                if(!this.previousFiles.includes(file)){
                    console.log("New file detected:", file);
                    if(notifyFrontend){
                    const fileData=fs.readFileSync(`${this.basePath}/${file}`)

                        UrlHandler.eventFromBackend.onSystemStateUpdate({type:"file", text:undefined, image:undefined, file:{name:file, data:fileData.buffer}})
                    }
                    this.previousFiles.push(file);
                }
            }
        }
    }
    constructor(private basePath:string){}
}

const clipBoardWatcher=new ClipBoardWatcher();
const fileSystemWatcher=new FileSystemWatcher("/home/compf/Downloads/")
fileSystemWatcher.update(false);
clipBoardWatcher.update(false);


export const updateSystemWatchers=(type:"clipboard"|"file")=>{
   if(type==="file"){
    fileSystemWatcher.update(true);
   }
   else{
    clipBoardWatcher.update(true);
   }
}