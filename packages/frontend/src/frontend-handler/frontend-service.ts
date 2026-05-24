import { Injectable } from "@angular/core";
import { EventFromBackendType } from "@linkrandomizer/common";

@Injectable({
    providedIn: 'root'
})
export  class FrontendService{
   private isElectron:boolean=window.isElectron;
}

const registeredCallbacks:Record<string,((data:any)=>void)>={
   
}

export const registerOrCallCallback=(name:keyof EventFromBackendType,callback?:(data:any)=>void, data?:any)=>{
    if(callback){
        registeredCallbacks[name]=callback;
    }else{
        registeredCallbacks[name](data);
    }
}

