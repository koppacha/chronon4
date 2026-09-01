import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptEmail, emailHmac, isValidEmail, normalizeEmail } from "@/lib/auth-crypto";
import { getClientIpHmac, rateLimitIdentifiersForIp, readJsonObject, validateMutationRequest } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordAuthAttempt, replacePasswordResetToken, waitForAccountLookupResponseFloor } from "@/lib/auth-service";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
const GENERIC_MESSAGE = "登録済みのメールアドレスであれば、パスワード再設定メールを送信しました。";

export async function POST(req: NextRequest) {
    const startedAtMs = Date.now();
    const requestCheck = validateMutationRequest(req);
    if ("error" in requestCheck) return NextResponse.json({ error: requestCheck.error }, { status: requestCheck.status });
    const ip = getClientIpHmac(req);
    const userAgent = req.headers.get("user-agent");

    try {
        const globalLimit = await consumeRateLimit({ operation: "password-reset-global", identifierHashes: ["global"], limit: 300, windowMs: 3_600_000, blockMs: 3_600_000 });
        const sourceLimit = await consumeRateLimit({ operation: "password-reset-source", identifierHashes: rateLimitIdentifiersForIp(ip), limit: 30, windowMs: 3_600_000, blockMs: 3_600_000 });
        if (!globalLimit.allowed || !sourceLimit.allowed) return NextResponse.json({ error: "送信回数が多すぎます。時間をおいて再試行してください。" }, {
            status: 429,
            headers: { "Retry-After": String(Math.max(globalLimit.retryAfterSeconds, sourceLimit.retryAfterSeconds)) },
        });
        const body = await readJsonObject(req);
        const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
        if (!isValidEmail(email)) return NextResponse.json({ error: "有効なメールアドレスを入力してください。" }, { status: 400 });
        const emailKey = emailHmac(email);
        const limit = await consumeRateLimit({ operation: "password-reset", identifierHashes: [emailKey, ip ?? ""], limit: 5, windowMs: 3_600_000, blockMs: 3_600_000 });
        if (!limit.allowed) return NextResponse.json({ error: "送信回数が多すぎます。時間をおいて再試行してください。" }, { status: 429 });

        const user = await prisma.user.findUnique({ where: { emailHmac: emailKey } });
        if (user?.verifiedAt && !user.deletedAt) {
            const token = await replacePasswordResetToken(user.id);
            try {
                await sendPasswordResetEmail(decryptEmail(user.emailEncrypted), token);
                await recordAuthAttempt({ operation: "password-reset", success: true, emailHmac: emailKey, ipHmac: ip, userAgent });
            } catch (error) {
                console.error("Password reset email delivery failed.", error instanceof Error ? error.name : "UnknownError");
                await recordAuthAttempt({ operation: "password-reset", success: false, failureReason: "email_delivery_failed", emailHmac: emailKey, ipHmac: ip, userAgent });
            }
        } else {
            await recordAuthAttempt({ operation: "password-reset", success: true, failureReason: "generic_missing", emailHmac: emailKey, ipHmac: ip, userAgent });
        }
        await waitForAccountLookupResponseFloor(startedAtMs);
        return NextResponse.json({ ok: true, message: GENERIC_MESSAGE }, { status: 202 });
    } catch (error) {
        console.error("Password reset request failed.", error instanceof Error ? error.name : "UnknownError");
        await waitForAccountLookupResponseFloor(startedAtMs);
        return NextResponse.json({ ok: true, message: GENERIC_MESSAGE }, { status: 202 });
    }
}
