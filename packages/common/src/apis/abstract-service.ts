import { WebsiteServiceSchema } from "./website-service.ts.js";
import { UrlServiceSchema } from "./url-service.js";
export const unsupported=()=>{
	throw new Error();
}
export const  sendToBackend={
	...WebsiteServiceSchema.sendToBackend,
	...UrlServiceSchema.sendToBackend
}

export const EventFromBackend={
	...WebsiteServiceSchema.eventFromBackend,
	...UrlServiceSchema.eventFromBackend
}

export const InvokeFromBackend={
	...WebsiteServiceSchema.invokeFromBackend,
	...UrlServiceSchema.invokeFromBackend
}

export const ElectronServiceScheme={
	invokeFromBackend:InvokeFromBackend,
	eventFromBackend:EventFromBackend,
	
	sendToBackend:sendToBackend
}

export type CallbackOrData<T>={(data:T):void} | T
export type ElectronService=typeof ElectronServiceScheme
export type SendToBackendType=typeof sendToBackend
export type EventFromBackendType=typeof EventFromBackend
export type InvokeFromBackendType = typeof InvokeFromBackend;