import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { ipHmac } from "@/lib/auth-crypto";

const MAX_USER_AGENT_LENGTH = 512;

export function sanitizeUserAgent(value: string | null): string | null {
    if (!value) return null;
    return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, MAX_USER_AGENT_LENGTH) || null;
}

export function getClientIpHmac(req: Request): string | null {
    if (process.env.TRUST_PROXY !== "1") return null;

    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = req.headers.get("x-real-ip")?.trim();
    const candidate = forwarded || realIp;
    return candidate && isIP(candidate) ? ipHmac(candidate) : null;
}

/** IPを信頼できない場合は、全利用者で共有する疑似識別子を作らない。 */
export function rateLimitIdentifiersForIp(ipHmacValue: string | null): string[] {
    return ipHmacValue ? [ipHmacValue] : [];
}

function allowedOrigins(req: Request): Set<string> {
    const origins = new Set<string>();
    const configured = process.env.NEXT_PUBLIC_BASE_URL;
    if (configured) {
        try {
            origins.add(new URL(configured).origin);
        } catch {
            // Invalid deployment configuration is handled by rejecting the request.
        }
    }
    if (process.env.NODE_ENV !== "production") {
        origins.add("http://localhost:3004");
        origins.add("http://127.0.0.1:3004");
    }
    // 本番でHost由来のreq.urlを許可元にすると、Host/Originを同時に偽装できる
    // 配備構成で検査が無効化される。開発時だけローカルURLを許可する。
    return origins;
}

export type MutationValidation = { ok: true } | { ok: false; status: number; error: string };

export function validateMutationRequest(req: Request): MutationValidation {
    const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") {
        return { ok: false, status: 415, error: "Unsupported content type." };
    }

    const fetchSite = req.headers.get("sec-fetch-site");
    if (fetchSite === "cross-site") {
        return { ok: false, status: 403, error: "Cross-site request rejected." };
    }

    const origin = req.headers.get("origin");
    if (!origin || !allowedOrigins(req).has(origin)) {
        return { ok: false, status: 403, error: "Invalid request origin." };
    }

    return { ok: true };
}

export async function readJsonObject(req: NextRequest | Request, maxBytes = 8192): Promise<Record<string, unknown>> {
    const length = Number(req.headers.get("content-length") || "0");
    if (Number.isFinite(length) && length > maxBytes) throw new Error("REQUEST_TOO_LARGE");
    const text = await req.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("REQUEST_TOO_LARGE");
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_JSON_OBJECT");
    return value as Record<string, unknown>;
}

export function sanitizeReferer(value: string | null): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        url.search = "";
        url.hash = "";
        return url.toString().slice(0, 512);
    } catch {
        return null;
    }
}
