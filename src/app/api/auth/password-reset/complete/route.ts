import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { csrfTokenHmac, decryptEmail, hashPassword, safeStringEqual, tokenHmac, validatePassword } from "@/lib/auth-crypto";
import { readJsonObject, validateMutationRequest } from "@/lib/request-security";
import { sendPasswordChangedEmail } from "@/lib/email";
import { RESET_COOKIE_NAME, RESET_CSRF_COOKIE_NAME } from "@/lib/reset-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const requestCheck = validateMutationRequest(req);
    if ("error" in requestCheck) return NextResponse.json({ error: requestCheck.error }, { status: requestCheck.status });

    const resetToken = req.cookies.get(RESET_COOKIE_NAME)?.value ?? "";
    const csrfCookie = req.cookies.get(RESET_CSRF_COOKIE_NAME)?.value ?? "";
    const csrfHeader = req.headers.get("x-csrf-token") ?? "";
    if (!resetToken || !csrfCookie || !csrfHeader || !safeStringEqual(csrfCookie, csrfHeader)) {
        return NextResponse.json({ error: "再設定セッションが無効です。" }, { status: 403 });
    }

    try {
        const body = await readJsonObject(req);
        const password = typeof body.password === "string" ? body.password : "";
        const confirm = typeof body.confirm === "string" ? body.confirm : "";
        const passwordError = validatePassword(password);
        if (passwordError || password !== confirm) {
            return NextResponse.json({ error: passwordError ?? "パスワードが一致しません。" }, { status: 400 });
        }

        const token = await prisma.passwordResetToken.findUnique({
            where: { tokenHash: tokenHmac(resetToken) },
            include: { user: true },
        });
        if (!token || !token.exchangedAt || token.expiresAt <= new Date() || !token.csrfTokenHash) {
            return NextResponse.json({ error: "再設定セッションが期限切れです。" }, { status: 403 });
        }
        if (!safeStringEqual(csrfTokenHmac(csrfHeader), token.csrfTokenHash)) {
            return NextResponse.json({ error: "再設定セッションが無効です。" }, { status: 403 });
        }

        const passwordHash = await hashPassword(password);
        await prisma.$transaction([
            prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
            prisma.passwordResetToken.delete({ where: { id: token.id } }),
            prisma.session.updateMany({
                where: { userId: token.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);
        try {
            await sendPasswordChangedEmail(decryptEmail(token.user.emailEncrypted));
        } catch (error) {
            console.error("Password changed notification failed.", error instanceof Error ? error.name : "UnknownError");
        }

        const response = NextResponse.json({ ok: true, message: "パスワードを変更しました。再度ログインしてください。" });
        response.cookies.delete(RESET_COOKIE_NAME);
        response.cookies.delete(RESET_CSRF_COOKIE_NAME);
        return response;
    } catch (error) {
        console.error("Password reset completion failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "パスワードを変更できませんでした。" }, { status: 500 });
    }
}
