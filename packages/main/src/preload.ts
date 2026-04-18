// To secure user platform when running renderer process stuff,
// Node.JS and Electron remote APIs are only available in this script


type SendToBackendType = import('@linkrandomizer/common').SendToBackendType;
type EventFromBackendType = import('@linkrandomizer/common').EventFromBackendType;
type InvokeFromBackendType = import('@linkrandomizer/common').InvokeFromBackendType;
const  { contextBridge, ipcRenderer }  =require('electron');
type IpcRendererEvent = import("electron").IpcRendererEvent;
const logging = (text: string) => {
	window.addEventListener("DOMContentLoaded", () => {
		document.body.innerHTML = `<div>${text}</div>`;
	});
};
const sendToBackendServices:Record<keyof SendToBackendType,null>={
	analyzeWebsite:null,
	openUrlInBrowser:null,
	updateClipBoard:null
}

const EventFromBackendServices:Record<keyof EventFromBackendType,null>={
	randomUrlsGenerated:null,
	websiteAnalysisComplete:null,
	websiteAnalysisStatus:null,
	onClipboardUpdate:null
}

const InvokeFromBackendServices:Record<keyof InvokeFromBackendType,null>={
	getAvailableWebsites:null,
	explainUrl:null,
	
	saveWebsites:null
}
const  sendToBackend=Object.keys(sendToBackendServices).map((it)=>{
	return [it,(data:any)=>{
		console.log("preload sendToBackend",it,data);
		ipcRenderer.send(it,data)
}]

}

)
const  invokeFromBackend=Object.keys(InvokeFromBackendServices).map((it)=>{return [it,(data:any)=> {return ipcRenderer.invoke(it,data)}]})
const _eventFromBackend = Object.fromEntries(
		Object.keys(EventFromBackendServices).map((it) => {
			return [
				it,
				(arg1: any, arg2: any) => {
					const callback = typeof arg2 === "function" ? arg2 : arg1;
					return ipcRenderer.on(
						it,
						(_event: IpcRendererEvent, ...parameters: any[]) => {
							callback(parameters[0]);
						},
					);
				},
			];
		}),
	);

// So we expose protected methods that allow the renderer process
// to use the ipcRenderer without exposing the entire object
// Notice that we can also expose variables, not just functions
contextBridge.exposeInMainWorld('api', {
	sendToBackend:Object.fromEntries(sendToBackend),
	invokeFromBackend:Object.fromEntries(invokeFromBackend),
	eventFromBackend:_eventFromBackend,
	
	
});

console.log('The preload script has been injected successfully.');
