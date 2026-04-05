import type { RandomURLPart, Website } from '@linkrandomizer/common';
export const isValidRandomURLVariable = (raw: any): raw is RandomURLPart => {
    if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string') return false;
    if (raw.name === 'randomFromRange') return typeof raw.min === 'number' && typeof raw.maxExclusive === 'number' && typeof raw.variableName === 'string';
    if (raw.name === 'randomDate') return typeof raw.minYear === 'number' && typeof raw.maxYearExclusive === 'number';
    if (raw.name === 'randomFromSelection') return Array.isArray(raw.values) && typeof raw.variableName === 'string';
    return false;
};

export const normalizeWebsite = (raw: any, fallbackUrl: string): Website | null => {
    if (!raw || typeof raw !== 'object') return null;
    const name = typeof raw.name === 'string' && raw.name ? raw.name : null;
    const tags = Array.isArray(raw.tags) ? raw.tags.filter((t: unknown) => typeof t === 'string') as string[] : [];
    const schemaRaw = raw.schema;
    const variablesRaw = Array.isArray(raw.variables) ? raw.variables : [];

    if (!name || !Array.isArray(schemaRaw)) return null;

    const schema = schemaRaw
        .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && typeof item.variable === 'string' && ('padding' in item)) {
                const padding = item.padding === null ? null : Number(item.padding);
                return { variable: item.variable, padding };
            }
            return null;
        })
        .filter((item: any): item is string | { variable: string; padding: number | null } => item !== null);

    if (schema.length === 0) return null;

    const variables = variablesRaw
        .filter(isValidRandomURLVariable)
        .map((v: RandomURLPart) => {
            const out = { ...v } as RandomURLPart;
            return out;
        });

    return { name, tags, schema, variables };
};

export const getHeuristicWebsiteFromLinks = (links: string[]): Website | null => {
    for (const l of links) {
        const digits = l.match(/^(.*?)(\d+)(.*)$/);
        if (!digits) continue;
        const prefix = digits[1] || '';
        const id = Number(digits[2]);
        const suffix = digits[3] || '';
        if (Number.isNaN(id)) continue;

        return {
            name: 'heuristic-generated',
            tags: ['heuristic', 'auto'],
            variables: [{
                name: 'randomFromRange',
                min: 1,
                suffix: "",
                maxExclusive: Math.max(1000, id * 10),
                variableName: 'id',
                
            } as RandomURLPart],
            schema: [prefix, { variable: 'id', padding: null }, suffix]
        };
    }
    return null;
};