import type { RegexWebsiteControllerDefinition } from "./regex-website-controller.js";

/** One turn of the controller-assistant dialogue (kept by the frontend, replayed per request). */
export type ControllerAssistMessage = {
    role: "user" | "assistant";
    content: string;
};

export type ControllerAssistRequest = {
    /** Page the crawl would start on; also the page sampled as evidence. */
    startUrl: string;
    /** The user's goal, or a correction of the previous proposal. */
    instruction: string;
    /** Prior dialogue turns; empty on the first request. */
    history: ControllerAssistMessage[];
};

export type ControllerAssistResult =
    | {
          ok: true;
          proposal: RegexWebsiteControllerDefinition;
          reasoning: string;
          /** Evidence links matching canBeVisitedRegex (sample). */
          sampleVisited: string[];
          /** Evidence links matching canBeReturnedRegex (sample). */
          sampleReturned: string[];
          /** Serialized assistant turn to append to the dialogue history. */
          assistantMessage: string;
      }
    | { ok: false; error: string };
