export function getPublicBaseUrl(): string {
    const value = process.env.NEXT_PUBLIC_BASE_URL;
    if (!value) throw new Error("NEXT_PUBLIC_BASE_URL is not configured.");
    const url = new URL(value);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
        throw new Error("NEXT_PUBLIC_BASE_URL must use HTTPS in production.");
    }
    return url.origin;
}
