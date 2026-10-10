/**
 * Per-origin browsing session (cookies + User-Agent) captured from the visible
 * browser tier after it has loaded a site — including any clearance cookie the
 * user obtained by passing a challenge. The HTTP tier reuses these so it is not
 * re-challenged on every page. This is session reuse, not evasion: nothing here
 * forges browser signals; it replays a session a real browser already earned.
 */
export type OriginSession = {
    userAgent: string;
    /** Ready-to-send Cookie header value. */
    cookieHeader: string;
    updatedAt: number;
};

const sessions = new Map<string, OriginSession>();

const originOf = (url: string): string | null => {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
};

export const setOriginSession = (
    url: string,
    userAgent: string,
    cookies: { name: string; value: string }[],
): void => {
    const origin = originOf(url);
    if (!origin) {
        return;
    }
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    sessions.set(origin, { userAgent, cookieHeader, updatedAt: Date.now() });
};

export const getOriginSession = (url: string): OriginSession | undefined => {
    const origin = originOf(url);
    return origin ? sessions.get(origin) : undefined;
};

export const clearOriginSessions = (): void => {
    sessions.clear();
};
