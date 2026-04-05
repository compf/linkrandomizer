import { UrlRandomizerServiceSchema } from "./url-randomizer-service.js";

export const unsupported=()=>{
	throw new Error();
}
export const  sendToBackend={
	...UrlRandomizerServiceSchema.sendToBackend
}

export const EventFromBackend={
	...UrlRandomizerServiceSchema.eventFromBackend
}

export const InvokeFromBackend={
	...UrlRandomizerServiceSchema.invokeFromBackend
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