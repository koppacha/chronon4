import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptEmail, emailHmac, isValidEmail, normalizeEmail } from "@/lib/auth-crypto";
import { getClientIpHmac, rateLimitIdentifiersForIp, readJsonObject, validateMutationRequest } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordAuthAttempt, replaceVerificationToken, verifyPasswordForUser } from "@/lib/auth-service";
import { sendVerificationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const requestCheck = validateMutationRequest(req);
    if ("error" in requestCheck) return NextResponse.json({ error: requestCheck.error }, { status: requestCheck.status });
    const ip = getClientIpHmac(req);
    const userAgent = req.headers.get("user-agent");

    try {
        const globalLimit = await consumeRateLimit({ operation: "verification-email-global", identifierHashes: ["global"], limit: 300, windowMs: 3_600_000, blockMs: 3_600_000 });
        const sourceLimit = await consumeRateLimit({ operation: "verification-email-source", identifierHashes: rateLimitIdentifiersForIp(ip), limit: 30, windowMs: 3_600_000, blockMs: 3_600_000 });
        if (!globalLimit.allowed || !sourceLimit.allowed) return NextResponse.json({ error: "送信回数が多すぎます。" }, {
            status: 429,
            headers: { "Retry-After": String(Math.max(globalLimit.retryAfterSeconds, sourceLimit.retryAfterSeconds)) },
        });
        const body = await readJsonObject(req);
        const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!isValidEmail(email) || !password) return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
        const emailKey = emailHmac(email);
        const limit = await consumeRateLimit({ operation: "verification-email", identifierHashes: [emailKey, ip ?? ""], limit: 10, windowMs: 3_600_000, blockMs: 3_600_000 });
        if (!limit.allowed) return NextResponse.json({ error: "送信回数が多すぎます。" }, { status: 429 });

        const user = await prisma.user.findUnique({ where: { emailHmac: emailKey } });
        const passwordOk = await verifyPasswordForUser(password, user?.passwordHash ?? null);
        if (!user || user.verifiedAt || user.deletedAt || !passwordOk) {
            await recordAuthAttempt({ operation: "verification-email", success: false, failureReason: "invalid_request", emailHmac: emailKey, ipHmac: ip, userAgent });
            return NextResponse.json({ error: "メールを再送できませんでした。" }, { status: 400 });
        }

        const token = await replaceVerificationToken(user.id);
        await sendVerificationEmail(decryptEmail(user.emailEncrypted), token);
        await recordAuthAttempt({ operation: "verification-email", success: true, emailHmac: emailKey, ipHmac: ip, userAgent });
        return NextResponse.json({ ok: true, message: "認証メールを再送しました。" });
    } catch (error) {
        console.error("Verification resend failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "メールを再送できませんでした。" }, { status: 500 });
    }
}
