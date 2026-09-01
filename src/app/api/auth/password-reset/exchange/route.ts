import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { csrfTokenHmac, randomToken, tokenHmac } from "@/lib/auth-crypto";
import { RESET_COOKIE_NAME, RESET_CSRF_COOKIE_NAME } from "@/lib/reset-session";
import { getPublicBaseUrl } from "@/lib/public-base-url";

export const dynamic = "force-dynamic";
function redirectToReset(req: NextRequest, status: string, resetToken?: string, csrfToken?: string) {
    const url = new URL("/password-reset", getPublicBaseUrl());
    url.searchParams.set("status", status);
    const response = NextResponse.redirect(url, 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    if (resetToken && csrfToken) {
        const common = { secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: 30 * 60 };
        response.cookies.set(RESET_COOKIE_NAME, resetToken, { ...common, httpOnly: true });
        response.cookies.set(RESET_CSRF_COOKIE_NAME, csrfToken, { ...common, httpOnly: false });
    }
    return response;
}

export async function GET(req: NextRequest) {
    const rawToken = req.nextUrl.searchParams.get("token") ?? "";
    if (!rawToken || rawToken.length > 256) return redirectToReset(req, "invalid");
    try {
        const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: tokenHmac(rawToken) } });
        if (!record) return redirectToReset(req, "invalid");
        if (record.expiresAt <= new Date()) {
            await prisma.passwordResetToken.delete({ where: { id: record.id } });
            return redirectToReset(req, "expired");
        }

        const resetToken = randomToken();
        const csrfToken = randomToken();
        await prisma.passwordResetToken.update({
            where: { id: record.id },
            data: {
                tokenHash: tokenHmac(resetToken),
                csrfTokenHash: csrfTokenHmac(csrfToken),
                exchangedAt: new Date(),
            },
        });
        return redirectToReset(req, "ready", resetToken, csrfToken);
    } catch (error) {
        console.error("Password reset token exchange failed.", error instanceof Error ? error.name : "UnknownError");
        return redirectToReset(req, "error");
    }
}
