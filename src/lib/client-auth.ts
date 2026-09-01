export function getCookieValueFromString(cookieString: string, names: string[]): string {
    const values = new Map<string, string>();
    for (const part of cookieString.split(";")) {
        const [rawName, ...rest] = part.trim().split("=");
        if (rawName) values.set(rawName, decodeURIComponent(rest.join("=")));
    }
    for (const name of names) {
        const value = values.get(name);
        if (value !== undefined) return value;
    }
    return "";
}

export function getCookieValue(names: string[]): string {
    if (typeof document === "undefined") return "";
    return getCookieValueFromString(document.cookie, names);
}

export function getAuthenticatedCsrfToken(): string {
    return getCookieValue(["__Host-chronon_csrf", "chronon_csrf"]);
}

export function getAnonymousCsrfToken(): string {
    return getCookieValue(["__Host-anon_csrf", "anon_csrf"]);
}

export type ClientSession = {
    authenticated: boolean;
    role?: number;
    displayName?: string;
    likeCount?: number;
    readCount?: number;
    lastRead?: { articleId: string; date: string } | null;
};

let clientSessionRequest: Promise<ClientSession> | null = null;

export function getClientSession(): Promise<ClientSession> {
    if (!clientSessionRequest) {
        clientSessionRequest = fetch("/api/auth/session", {
            cache: "no-store",
            credentials: "same-origin",
        })
            .then((response) => response.ok ? response.json() as Promise<ClientSession> : { authenticated: false })
            .catch(() => ({ authenticated: false }));
    }
    return clientSessionRequest;
}

export function clearClientSessionCache(): void {
    clientSessionRequest = null;
}

export async function authenticatedJsonFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    const csrf = getAuthenticatedCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
    return fetch(url, { ...options, headers, credentials: "same-origin" });
}

export async function anonymousJsonFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    const csrf = getAnonymousCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
    return fetch(url, { ...options, headers, credentials: "same-origin" });
}
