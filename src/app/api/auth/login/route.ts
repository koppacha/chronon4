import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createLoginSession } from "@/lib/auth-session";
import { emailHmac, isValidEmail, normalizeEmail, newCorrelationHash } from "@/lib/auth-crypto";
import { getClientIpHmac, rateLimitIdentifiersForIp, readJsonObject, validateMutationRequest } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import { maybeSendAdminLoginNotification, recordAuthAttempt, verifyPasswordForUser } from "@/lib/auth-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const requestCheck = validateMutationRequest(req);
    if ("error" in requestCheck) return NextResponse.json({ error: requestCheck.error }, { status: requestCheck.status });

    const correlationHash = newCorrelationHash();
    const ip = getClientIpHmac(req);
    const userAgent = req.headers.get("user-agent");

    try {
        const body = await readJsonObject(req);
        const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
        const password = typeof body.password === "string" ? body.password : "";
        const emailKey = isValidEmail(email) ? emailHmac(email) : null;

        const globalLimit = await consumeRateLimit({
            operation: "login_global",
            identifierHashes: ["global"],
            limit: 3_000,
            windowMs: 10 * 60 * 1000,
            blockMs: 10 * 60 * 1000,
        });
        if (!globalLimit.allowed) {
            return NextResponse.json({ error: "ログイン試行が多すぎます。時間をおいて再試行してください。" }, {
                status: 429,
                headers: { "Retry-After": String(globalLimit.retryAfterSeconds) },
            });
        }

        const sourceLimit = await consumeRateLimit({
            operation: "login_source",
            identifierHashes: rateLimitIdentifiersForIp(ip),
            limit: 300,
            windowMs: 10 * 60 * 1000,
            blockMs: 10 * 60 * 1000,
        });
        if (!sourceLimit.allowed) {
            return NextResponse.json({ error: "ログイン試行が多すぎます。時間をおいて再試行してください。" }, {
                status: 429,
                headers: { "Retry-After": String(sourceLimit.retryAfterSeconds) },
            });
        }

        if (!emailKey || !password || Buffer.byteLength(password, "utf8") > 256) {
            await recordAuthAttempt({ operation: "login", success: false, failureReason: "invalid_input", emailHmac: emailKey, ipHmac: ip, userAgent, correlationHash });
            return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません。" }, { status: 401 });
        }

        const limit = await consumeRateLimit({
            operation: "login",
            identifierHashes: [emailKey, ip ?? ""],
            limit: 10,
            windowMs: 10 * 60 * 1000,
            blockMs: 60 * 60 * 1000,
        });
        if (!limit.allowed) {
            await recordAuthAttempt({ operation: "login", success: false, failureReason: "rate_limited", emailHmac: emailKey, ipHmac: ip, userAgent, correlationHash });
            return NextResponse.json({ error: "ログイン試行が多すぎます。時間をおいて再試行してください。" }, {
                status: 429,
                headers: { "Retry-After": String(limit.retryAfterSeconds) },
            });
        }

        const user = await prisma.user.findUnique({ where: { emailHmac: emailKey } });
        const passwordOk = await verifyPasswordForUser(password, user?.passwordHash ?? null);
        if (!user || user.deletedAt || !passwordOk) {
            await recordAuthAttempt({ operation: "login", success: false, failureReason: "invalid_credentials", emailHmac: emailKey, ipHmac: ip, userAgent, correlationHash });
            return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません。" }, { status: 401 });
        }
        if (!user.verifiedAt) {
            await recordAuthAttempt({ operation: "login", success: false, failureReason: "email_unverified", emailHmac: emailKey, ipHmac: ip, userAgent, correlationHash });
            return NextResponse.json({
                error: "メール認証が完了していません。メールを再送信できます。",
                code: "EMAIL_UNVERIFIED",
            }, { status: 403 });
        }

        const now = new Date();
        await createLoginSession(user.id, user.role, req);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
        await recordAuthAttempt({ operation: "login", success: true, emailHmac: emailKey, ipHmac: ip, userAgent, correlationHash });
        void maybeSendAdminLoginNotification(user, now);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Login failed.", correlationHash, error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "ログイン処理に失敗しました。", correlationId: correlationHash.slice(0, 12) }, { status: 500 });
    }
}
