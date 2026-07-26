import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Page } from "playwright";
import {
    isRegexWebsiteControllerDefinition,
    type RegexWebsiteControllerDefinition,
} from "@linkrandomizer/common";
import type { WebsiteController } from "../../url-finder-type.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Hand-written and UI-crafted controllers live here (next to heise.ts, etc.). */
export const CONTROLLER_SCRIPTS_DIR = path.resolve(__dirname, "../../src/scripts");

export const sanitizeControllerFileName = (name: string): string => {
    const cleaned = name.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!cleaned) {
        throw new Error("Controller name must contain letters or numbers.");
    }
    return cleaned;
};

export const controllerJsonPath = (name: string): string =>
    path.join(CONTROLLER_SCRIPTS_DIR, `${sanitizeControllerFileName(name)}.json`);

export const controllerJsPath = (name: string): string =>
    path.join(CONTROLLER_SCRIPTS_DIR, `${sanitizeControllerFileName(name)}.js`);

const validateRegex = (label: string, pattern: string, allowEmpty: boolean) => {
    if (!pattern) {
        if (allowEmpty) {
            return;
        }
        throw new Error(`${label} must not be empty.`);
    }
    try {
        new RegExp(pattern);
    } catch {
        throw new Error(`${label} is not a valid regular expression.`);
    }
};

export const validateControllerDefinition = (def: RegexWebsiteControllerDefinition): void => {
    if (!def.name.trim()) {
        throw new Error("Name is required.");
    }
    if (!def.initialUrl.trim()) {
        throw new Error("Initial URL is required.");
    }
    if (!def.parentDomain.trim()) {
        throw new Error("Parent domain is required.");
    }
    if (!Number.isFinite(def.maxDepth) || def.maxDepth < 0) {
        throw new Error("Max depth must be a non-negative number.");
    }
    validateRegex("canBeVisitedRegex", def.canBeVisitedRegex, false);
    validateRegex("canBeReturnedRegex", def.canBeReturnedRegex, false);
    validateRegex("requireUserAttentionRegex", def.requireUserAttentionRegex, true);
};

const toExportName = (name: string): string => {
    const parts = sanitizeControllerFileName(name).split(/[_-]+/).filter(Boolean);
    const pascal = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    return `${pascal || "Custom"}Controller`;
};

export const generateControllerJs = (def: RegexWebsiteControllerDefinition): string => {
    const exportName = toExportName(def.name);
    return `/** Auto-generated from ${sanitizeControllerFileName(def.name)}.json — prefer editing the JSON. */
export const ${exportName} = {
  canBeVisited: (url) => new RegExp(${JSON.stringify(def.canBeVisitedRegex)}).test(url),
  canBeReturned: (url) => new RegExp(${JSON.stringify(def.canBeReturnedRegex)}).test(url),
  requireUserAttention: async (page) => {
    const pattern = ${JSON.stringify(def.requireUserAttentionRegex)};
    if (!pattern) return false;
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    return new RegExp(pattern).test(text);
  },
  maxDepth: () => ${JSON.stringify(def.maxDepth)},
  initialUrl: () => ${JSON.stringify(def.initialUrl)},
  name: () => ${JSON.stringify(def.name)},
  parentDomain: () => ${JSON.stringify(def.parentDomain)},
};
`;
};

export const controllerFromDefinition = (
    def: RegexWebsiteControllerDefinition,
): WebsiteController => {
    validateControllerDefinition(def);
    const visitRe = new RegExp(def.canBeVisitedRegex);
    const returnRe = new RegExp(def.canBeReturnedRegex);
    const attentionPattern = def.requireUserAttentionRegex;
    const attentionRe = attentionPattern ? new RegExp(attentionPattern) : null;

    return {
        canBeVisited: (url: string) => visitRe.test(url),
        canBeReturned: (url: string) => returnRe.test(url),
        requireUserAttention: async (page: Page) => {
            if (!attentionRe) {
                return false;
            }
            const text = await page.evaluate(() => document.body?.innerText ?? "");
            return attentionRe.test(text);
        },
        maxDepth: () => def.maxDepth,
        initialUrl: () => def.initialUrl,
        name: () => def.name,
        parentDomain: () => def.parentDomain,
    };
};

export const ensureScriptsDir = () => {
    if (!fs.existsSync(CONTROLLER_SCRIPTS_DIR)) {
        fs.mkdirSync(CONTROLLER_SCRIPTS_DIR, { recursive: true });
    }
};

export const saveControllerDefinition = (
    def: RegexWebsiteControllerDefinition,
): { jsonPath: string; jsPath: string } => {
    validateControllerDefinition(def);
    ensureScriptsDir();
    const normalized: RegexWebsiteControllerDefinition = {
        ...def,
        name: def.name.trim(),
        initialUrl: def.initialUrl.trim(),
        parentDomain: def.parentDomain.trim(),
    };
    const jsonPath = controllerJsonPath(normalized.name);
    const jsPath = controllerJsPath(normalized.name);
    fs.writeFileSync(jsonPath, JSON.stringify(normalized, null, 2) + "\n", "utf8");
    fs.writeFileSync(jsPath, generateControllerJs(normalized), "utf8");
    return { jsonPath, jsPath };
};

export const loadControllerDefinition = (
    name: string,
): RegexWebsiteControllerDefinition | null => {
    const jsonPath = controllerJsonPath(name);
    if (!fs.existsSync(jsonPath)) {
        return null;
    }
    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as unknown;
    if (!isRegexWebsiteControllerDefinition(parsed)) {
        throw new Error(`Invalid controller definition: ${jsonPath}`);
    }
    return parsed;
};

export const listControllerDefinitions = (): RegexWebsiteControllerDefinition[] => {
    ensureScriptsDir();
    const files = fs.readdirSync(CONTROLLER_SCRIPTS_DIR).filter((f) => f.endsWith(".json"));
    const definitions: RegexWebsiteControllerDefinition[] = [];
    for (const file of files) {
        try {
            const parsed = JSON.parse(
                fs.readFileSync(path.join(CONTROLLER_SCRIPTS_DIR, file), "utf8"),
            ) as unknown;
            if (isRegexWebsiteControllerDefinition(parsed)) {
                definitions.push(parsed);
            }
        } catch {
            // Skip unrelated or corrupt JSON files.
        }
    }
    return definitions.sort((a, b) => a.name.localeCompare(b.name));
};

export const loadControllerFromFile = async (filePath: string): Promise<WebsiteController> => {
    if (filePath.endsWith(".json")) {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
        if (!isRegexWebsiteControllerDefinition(parsed)) {
            throw new Error(`Not a regex controller definition: ${filePath}`);
        }
        return controllerFromDefinition(parsed);
    }
    const module = await import(filePath);
    return Object.values(module)[0] as WebsiteController;
};
