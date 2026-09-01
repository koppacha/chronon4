import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { emailHmac, encryptEmail, hashPassword, isValidEmail, normalizeEmail, validatePassword } from "@/lib/auth-crypto";
import { getClientIpHmac, rateLimitIdentifiersForIp, readJsonObject, validateMutationRequest } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
    createUnverifiedUser,
    recordAuthAttempt,
    replaceVerificationToken,
    waitForAccountLookupResponseFloor,
} from "@/lib/auth-service";
import { sendVerificationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
const ACCEPTED_MESSAGE = "メールを送信しました。メールの指示に従って認証を完了してください。";

export async function POST(req: NextRequest) {
    const startedAtMs = Date.now();
    const requestCheck = validateMutationRequest(req);
    if ("error" in requestCheck) return NextResponse.json({ error: requestCheck.error }, { status: requestCheck.status });

    const ip = getClientIpHmac(req);
    const userAgent = req.headers.get("user-agent");
    try {
        const globalLimit = await consumeRateLimit({
            operation: "signup_global",
            identifierHashes: ["global"],
            limit: 300,
            windowMs: 60 * 60 * 1000,
            blockMs: 60 * 60 * 1000,
        });
        if (!globalLimit.allowed) return NextResponse.json({ error: "試行回数が多すぎます。時間をおいて再試行してください。" }, {
            status: 429,
            headers: { "Retry-After": String(globalLimit.retryAfterSeconds) },
        });

        const sourceLimit = await consumeRateLimit({
            operation: "signup_source",
            identifierHashes: rateLimitIdentifiersForIp(ip),
            limit: 30,
            windowMs: 60 * 60 * 1000,
            blockMs: 60 * 60 * 1000,
        });
        if (!sourceLimit.allowed) return NextResponse.json({ error: "試行回数が多すぎます。時間をおいて再試行してください。" }, {
            status: 429,
            headers: { "Retry-After": String(sourceLimit.retryAfterSeconds) },
        });

        const body = await readJsonObject(req);
        const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
        const password = typeof body.password === "string" ? body.password : "";
        const passwordError = validatePassword(password);
        if (!isValidEmail(email) || passwordError) {
            return NextResponse.json({ error: passwordError ?? "有効なメールアドレスを入力してください。" }, { status: 400 });
        }

        const emailKey = emailHmac(email);
        const limit = await consumeRateLimit({
            operation: "signup",
            identifierHashes: [emailKey, ip ?? ""],
            limit: 10,
            windowMs: 60 * 60 * 1000,
            blockMs: 60 * 60 * 1000,
        });
        if (!limit.allowed) {
            await recordAuthAttempt({ operation: "signup", success: false, failureReason: "rate_limited", emailHmac: emailKey, ipHmac: ip, userAgent });
            return NextResponse.json({ error: "試行回数が多すぎます。時間をおいて再試行してください。" }, { status: 429 });
        }

        const existing = await prisma.user.findUnique({ where: { emailHmac: emailKey } });
        if (existing) {
            await recordAuthAttempt({ operation: "signup", success: true, failureReason: "generic_existing", emailHmac: emailKey, ipHmac: ip, userAgent });
            await waitForAccountLookupResponseFloor(startedAtMs);
            return NextResponse.json({ ok: true, message: ACCEPTED_MESSAGE }, { status: 202 });
        }

        const encrypted = encryptEmail(email);
        const passwordHash = await hashPassword(password);
        const user = await createUnverifiedUser({
            emailEncrypted: encrypted.encrypted,
            emailKeyVersion: encrypted.keyVersion,
            emailHmac: emailKey,
            passwordHash,
        });
        if (!user) {
            await recordAuthAttempt({ operation: "signup", success: true, failureReason: "generic_existing", emailHmac: emailKey, ipHmac: ip, userAgent });
            await waitForAccountLookupResponseFloor(startedAtMs);
            return NextResponse.json({ ok: true, message: ACCEPTED_MESSAGE }, { status: 202 });
        }
        const token = await replaceVerificationToken(user.id);
        try {
            await sendVerificationEmail(email, token);
        } catch (error) {
            console.error("Verification email delivery failed.", error instanceof Error ? error.name : "UnknownError");
            await recordAuthAttempt({ operation: "signup", success: false, failureReason: "email_delivery_failed", emailHmac: emailKey, ipHmac: ip, userAgent });
            await waitForAccountLookupResponseFloor(startedAtMs);
            return NextResponse.json({ ok: true, message: ACCEPTED_MESSAGE }, { status: 202 });
        }

        await recordAuthAttempt({ operation: "signup", success: true, emailHmac: emailKey, ipHmac: ip, userAgent });
        await waitForAccountLookupResponseFloor(startedAtMs);
        return NextResponse.json({ ok: true, message: ACCEPTED_MESSAGE }, { status: 202 });
    } catch (error) {
        console.error("Signup failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "アカウント作成処理に失敗しました。" }, { status: 500 });
    }
}
