import "server-only";

import type { NextRequest } from "next/server";
import { getCurrentSession, validateAuthenticatedMutation } from "@/lib/auth-session";
import { safeStringEqual } from "@/lib/auth-crypto";
import { isValidAnonymousSessionId } from "@/lib/anonymous-session";
import { validateMutationRequest } from "@/lib/request-security";
import type { CurrentSession } from "@/lib/auth-session";
import type { ReadActor } from "@/lib/read-status";

const ANON_CSRF_COOKIE = process.env.NODE_ENV === "production" ? "__Host-anon_csrf" : "anon_csrf";

export type ResolvedReadActor = {
    actor: ReadActor;
    role: number;
    authenticated: boolean;
    session: CurrentSession | null;
};

export async function resolveReadActor(req: NextRequest): Promise<ResolvedReadActor | null> {
    const session = await getCurrentSession();
    if (session) return {
        actor: { type: "user", id: String(session.user.id) },
        role: session.user.role,
        authenticated: true,
        session,
    };
    const anonymousId = req.cookies.get("access_id")?.value;
    if (!isValidAnonymousSessionId(anonymousId)) return null;
    return {
        actor: { type: "anonymous", id: anonymousId },
        role: 0,
        authenticated: false,
        session: null,
    };
}

export async function validateReadMutation(req: NextRequest): Promise<
    { ok: true; value: ResolvedReadActor } |
    { ok: false; status: number; error: string }
> {
    const session = await getCurrentSession();
    if (session) {
        const auth = await validateAuthenticatedMutation(req);
        if ("error" in auth) return auth;
        return {
            ok: true,
            value: {
                actor: { type: "user", id: String(auth.session.user.id) },
                role: auth.session.user.role,
                authenticated: true,
                session: auth.session,
            },
        };
    }

    const requestCheck = validateMutationRequest(req);
    if ("error" in requestCheck) return requestCheck;
    const anonymousId = req.cookies.get("access_id")?.value;
    if (!isValidAnonymousSessionId(anonymousId)) {
        return { ok: false, status: 401, error: "No anonymous session." };
    }
    const csrfCookie = req.cookies.get(ANON_CSRF_COOKIE)?.value ?? "";
    const csrfHeader = req.headers.get("x-csrf-token") ?? "";
    if (!csrfCookie || !csrfHeader || !safeStringEqual(csrfCookie, csrfHeader)) {
        return { ok: false, status: 403, error: "Invalid CSRF token." };
    }
    return {
        ok: true,
        value: {
            actor: { type: "anonymous", id: anonymousId },
            role: 0,
            authenticated: false,
            session: null,
        },
    };
}
