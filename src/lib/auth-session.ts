import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
    csrfTokenHmac,
    opaqueHmac,
    randomToken,
    safeStringEqual,
    sessionTokenHmac,
} from "@/lib/auth-crypto";
import { getClientIpHmac, sanitizeUserAgent, validateMutationRequest } from "@/lib/request-security";
import {
    DEV_AUTH_SESSION_ID,
    devAuthRoleNumber,
    getDevAuthRole,
    getOrCreateDevDummyUser,
    isDevAuthMockEnabled,
} from "@/lib/dev-auth";

const USER_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
const USER_ABSOLUTE_MS = 120 * 24 * 60 * 60 * 1000;
const ADMIN_IDLE_MS = 12 * 60 * 60 * 1000;
const ADMIN_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const AUTH_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-chronon_session" : "chronon_session";
export const CSRF_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-chronon_csrf" : "chronon_csrf";

export type CurrentSession = {
    sessionId: number;
    csrfTokenHash: string;
    user: {
        id: number;
        readerNumber: number | null;
        emailEncrypted: string;
        handleName: string | null;
        role: number;
        verifiedAt: Date | null;
    };
};

function idleMsForRole(role: number): number {
    return role >= 10 ? ADMIN_IDLE_MS : USER_IDLE_MS;
}

function absoluteMsForRole(role: number): number {
    return role >= 10 ? ADMIN_ABSOLUTE_MS : USER_ABSOLUTE_MS;
}

function cookieBase() {
    return {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
    };
}

export async function createLoginSession(userId: number, role: number, req: Request): Promise<void> {
    const token = randomToken();
    const csrfToken = randomToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + absoluteMsForRole(role));
    const userAgent = sanitizeUserAgent(req.headers.get("user-agent"));

    await prisma.session.create({
        data: {
            userId,
            tokenHash: sessionTokenHmac(token),
            csrfTokenHash: csrfTokenHmac(csrfToken),
            userAgentHash: userAgent ? opaqueHmac("user-agent", userAgent) : null,
            ipHmac: getClientIpHmac(req),
            expiresAt,
        },
    });

    const store = await cookies();
    store.set(AUTH_COOKIE_NAME, token, {
        ...cookieBase(),
        httpOnly: true,
        expires: expiresAt,
    });
    store.set(CSRF_COOKIE_NAME, csrfToken, {
        ...cookieBase(),
        httpOnly: false,
        expires: expiresAt,
    });
}

export async function getCurrentSession(now = new Date()): Promise<CurrentSession | null> {
    if (isDevAuthMockEnabled()) {
        const devRole = await getDevAuthRole();
        const role = devAuthRoleNumber(devRole);
        if (role === 0) return null;
        const user = await getOrCreateDevDummyUser();
        return {
            sessionId: DEV_AUTH_SESSION_ID,
            csrfTokenHash: "development-only",
            user: {
                id: user.id,
                readerNumber: user.readerNumber,
                emailEncrypted: user.emailEncrypted,
                handleName: user.handleName,
                role,
                verifiedAt: user.verifiedAt,
            },
        };
    }

    const store = await cookies();
    const token = store.get(AUTH_COOKIE_NAME)?.value;
    if (!token || token.length > 256) return null;

    const session = await prisma.session.findUnique({
        where: { tokenHash: sessionTokenHmac(token) },
        include: { user: true },
    });
    if (!session || session.revokedAt || session.user.deletedAt || !session.user.verifiedAt) return null;

    const idleExpired = now.getTime() - session.lastUsedAt.getTime() > idleMsForRole(session.user.role);
    if (session.expiresAt <= now || idleExpired) {
        await prisma.session.update({ where: { id: session.id }, data: { revokedAt: now } }).catch(() => undefined);
        return null;
    }

    if (now.getTime() - session.lastUsedAt.getTime() >= TOUCH_INTERVAL_MS) {
        await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    }

    return {
        sessionId: session.id,
        csrfTokenHash: session.csrfTokenHash,
        user: {
            id: session.user.id,
            readerNumber: session.user.readerNumber,
            emailEncrypted: session.user.emailEncrypted,
            handleName: session.user.handleName,
            role: session.user.role,
            verifiedAt: session.user.verifiedAt,
        },
    };
}

export async function getViewerRole(): Promise<number> {
    return (await getCurrentSession())?.user.role ?? 0;
}

export async function revokeCurrentSession(): Promise<void> {
    const store = await cookies();
    const token = store.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
        await prisma.session.updateMany({
            where: { tokenHash: sessionTokenHmac(token), revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    store.delete(AUTH_COOKIE_NAME);
    store.delete(CSRF_COOKIE_NAME);
}

export async function revokeAllUserSessions(userId: number): Promise<void> {
    await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}

export async function validateAuthenticatedMutation(req: NextRequest): Promise<
    { ok: true; session: CurrentSession } |
    { ok: false; status: number; error: string }
> {
    const requestCheck = validateMutationRequest(req);
    if ("error" in requestCheck) return requestCheck;

    const session = await getCurrentSession();
    if (!session) return { ok: false, status: 401, error: "Authentication required." };
    if (isDevAuthMockEnabled() && session.sessionId === DEV_AUTH_SESSION_ID) {
        return { ok: true, session };
    }

    const store = await cookies();
    const cookieToken = store.get(CSRF_COOKIE_NAME)?.value ?? "";
    const headerToken = req.headers.get("x-csrf-token") ?? "";
    if (!cookieToken || !headerToken || !safeStringEqual(cookieToken, headerToken)) {
        return { ok: false, status: 403, error: "Invalid CSRF token." };
    }
    if (!safeStringEqual(csrfTokenHmac(headerToken), session.csrfTokenHash)) {
        return { ok: false, status: 403, error: "Invalid CSRF token." };
    }

    return { ok: true, session };
}
