export type DatePeriod = {
    year?: number;
    month?: number;
    start?: ExtractedDate;
    end?: ExtractedDate;
};

export type CalendarDay = {
    year: number;
    month: number;
    day: number;
};

export type ExtractedDate = {
    year?: number;
    month?: number;
    day?: number;
};

const MONTH_NAMES: { month: number; names: string[] }[] = [
    { month: 1, names: ["january", "januar", "jan"] },
    { month: 2, names: ["february", "februar", "feb"] },
    { month: 3, names: ["march", "märz", "maerz", "marz", "mar"] },
    { month: 4, names: ["april", "apr"] },
    { month: 5, names: ["may", "mai"] },
    { month: 6, names: ["june", "juni", "jun"] },
    { month: 7, names: ["july", "juli", "jul"] },
    { month: 8, names: ["august", "aug"] },
    { month: 9, names: ["september", "sep", "sept"] },
    { month: 10, names: ["october", "oktober", "oct", "okt"] },
    { month: 11, names: ["november", "nov"] },
    { month: 12, names: ["december", "dezember", "dec", "dez"] },
];

const ENGLISH_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export const isYearVariableName = (name: string): boolean =>
    /^year\d*$/i.test(name);

export const isMonthVariableName = (name: string): boolean =>
    /^month\d*$/i.test(name);

export const isDayVariableName = (name: string): boolean =>
    /^day\d*$/i.test(name);

export const periodIsEmpty = (period?: DatePeriod): boolean =>
    !period || (
        period.year === undefined &&
        period.month === undefined &&
        period.start?.year === undefined &&
        period.end?.year === undefined
    );

export const compareCalendarDays = (left: CalendarDay, right: CalendarDay): number => {
    if (left.year !== right.year) {
        return left.year - right.year;
    }
    if (left.month !== right.month) {
        return left.month - right.month;
    }
    return left.day - right.day;
};

export const daysInMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
};

export const calendarDayFromJsDate = (date: Date): CalendarDay => ({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
});

export const jsDateFromCalendarDay = (day: CalendarDay): Date => {
    const date = new Date(0);
    date.setFullYear(day.year, day.month - 1, day.day);
    date.setHours(12, 0, 0, 0);
    return date;
};

export const fillStart = (date: ExtractedDate): CalendarDay | undefined => {
    if (date.year === undefined) {
        return undefined;
    }
    const month = date.month ?? 1;
    const day = date.day ?? 1;
    return { year: date.year, month, day };
};

export const fillEnd = (date: ExtractedDate): CalendarDay | undefined => {
    if (date.year === undefined) {
        return undefined;
    }
    const month = date.month ?? 12;
    const day = date.day ?? daysInMonth(date.year, month);
    return { year: date.year, month, day };
};

export const periodToInclusiveRange = (
    period?: DatePeriod,
): { start: CalendarDay; end: CalendarDay } | undefined => {
    if (periodIsEmpty(period) || !period) {
        return undefined;
    }
    if (period.start?.year !== undefined || period.end?.year !== undefined) {
        const start = fillStart(period.start ?? period.end ?? {});
        const end = fillEnd(period.end ?? period.start ?? {});
        if (!start || !end) {
            return undefined;
        }
        return compareCalendarDays(start, end) <= 0 ? { start, end } : { start: end, end: start };
    }
    if (period.year !== undefined && period.month !== undefined) {
        return {
            start: { year: period.year, month: period.month, day: 1 },
            end: {
                year: period.year,
                month: period.month,
                day: daysInMonth(period.year, period.month),
            },
        };
    }
    if (period.year !== undefined) {
        return {
            start: { year: period.year, month: 1, day: 1 },
            end: { year: period.year, month: 12, day: 31 },
        };
    }
    return undefined;
};

const calendarFromUtc = (ms: number): CalendarDay => {
    const date = new Date(ms);
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
    };
};

export const sampleDateInPeriod = (
    period?: DatePeriod,
    minYear = 1,
    maxYearExclusive = 2027,
): CalendarDay => {
    const siteStart: CalendarDay = { year: minYear, month: 1, day: 1 };
    const lastYear = maxYearExclusive - 1;
    const siteEnd: CalendarDay = {
        year: lastYear,
        month: 12,
        day: daysInMonth(lastYear, 12),
    };
    const range = periodToInclusiveRange(period);
    const start = range && compareCalendarDays(range.start, siteStart) > 0 ? range.start : siteStart;
    const end = range && compareCalendarDays(range.end, siteEnd) < 0 ? range.end : siteEnd;
    if (compareCalendarDays(start, end) > 0) {
        return start;
    }
    const startMs = Date.UTC(start.year, start.month - 1, start.day);
    const endMs = Date.UTC(end.year, end.month - 1, end.day);
    const span = endMs - startMs;
    const picked = startMs + Math.floor(Math.random() * (span + 86_400_000));
    return calendarFromUtc(Math.min(picked, endMs));
};

export const randomInt = (min: number, maxExclusive: number): number => {
    if (!Number.isFinite(min) || !Number.isFinite(maxExclusive)) {
        return min;
    }
    if (maxExclusive <= min) {
        return Math.floor(min);
    }
    return min + Math.floor(Math.random() * (maxExclusive - min));
};

const toInt = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && String(parsed) === value.trim()) {
            return parsed;
        }
        if (Number.isFinite(parsed) && /^\d+$/.test(value.trim())) {
            return parsed;
        }
    }
    return undefined;
};

export const parseMonthValue = (value: unknown): number | undefined => {
    const asInt = toInt(value);
    if (asInt !== undefined && asInt >= 1 && asInt <= 12) {
        return asInt;
    }
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    for (const entry of MONTH_NAMES) {
        if (entry.names.some((name) => name.normalize("NFD").replace(/\p{M}/gu, "") === normalized)) {
            return entry.month;
        }
    }
    return undefined;
};

export const monthNameForValues = (month: number, values: string[]): string | undefined => {
    return values.find((value) => parseMonthValue(value) === month);
};

export const formatMonthName = (month: number): string => {
    return ENGLISH_MONTHS[month - 1] ?? String(month);
};

export const extractDateFromString = (value: string): ExtractedDate => {
    const iso = value.match(/(1[89]\d{2}|20\d{2}|21\d{2})[-/._](0?[1-9]|1[0-2])(?:[-/._](0?[1-9]|[12]\d|3[01]))?/);
    if (iso) {
        return {
            year: Number.parseInt(iso[1], 10),
            month: Number.parseInt(iso[2], 10),
            day: iso[3] ? Number.parseInt(iso[3], 10) : undefined,
        };
    }

    const yearMatch = value.match(/(?:^|[^\d])(1[89]\d{2}|20\d{2}|21\d{2})(?:[^\d]|$)/);
    if (!yearMatch) {
        return {};
    }
    const year = Number.parseInt(yearMatch[1], 10);
    const monthMatch = value.match(/(?:^|[^\d])(1[89]\d{2}|20\d{2}|21\d{2})[^\d](0?[1-9]|1[0-2])(?:[^\d]|$)/);
    return {
        year,
        month: monthMatch ? Number.parseInt(monthMatch[2], 10) : undefined,
    };
};

export const extractDateFromVariables = (
    variables: Record<string, unknown>,
    url?: string,
): ExtractedDate => {
    const year = toInt(variables.year ?? variables.year1);
    const month = parseMonthValue(variables.month ?? variables.month1);
    const day = toInt(variables.day ?? variables.day1);

    if (year !== undefined) {
        return { year, month, day };
    }
    if (url) {
        return extractDateFromString(url);
    }
    return {};
};

export const dateMatchesPeriod = (date: ExtractedDate, period?: DatePeriod): boolean => {
    const range = periodToInclusiveRange(period);
    if (!range) {
        return true;
    }
    if (date.year === undefined) {
        return false;
    }
    const start = fillStart(date);
    const end = fillEnd(date);
    if (!start || !end) {
        return false;
    }
    return compareCalendarDays(start, range.end) <= 0 && compareCalendarDays(end, range.start) >= 0;
};

export const formatDateLabel = (date: ExtractedDate): string | undefined => {
    if (date.year === undefined) {
        return undefined;
    }
    if (date.month !== undefined && date.day !== undefined) {
        return `${formatMonthName(date.month)} ${date.day}, ${date.year}`;
    }
    if (date.month !== undefined) {
        return `${formatMonthName(date.month)} ${date.year}`;
    }
    return String(date.year);
};

export const formatPeriodLabel = (period?: DatePeriod): string => {
    const range = periodToInclusiveRange(period);
    if (!range) {
        return "Any time";
    }
    const startLabel = formatDateLabel(range.start);
    const endLabel = formatDateLabel(range.end);
    if (startLabel && endLabel && startLabel !== endLabel) {
        return `${startLabel} – ${endLabel}`;
    }
    return startLabel ?? endLabel ?? "Dated period";
};

export const constrainRangeValue = (
    min: number,
    maxExclusive: number,
    preferred?: number,
): number => {
    if (preferred !== undefined && preferred >= min && preferred < maxExclusive) {
        return preferred;
    }
    return randomInt(min, maxExclusive);
};
