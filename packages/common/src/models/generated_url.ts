import { Website } from "./website_schemas.js"

export type GeneratedURL={
    url:string,
    variables:Record<string,unknown>,
    website:Website
}