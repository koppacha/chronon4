import prisma from "@/lib/prisma";
import {
    decryptEmail,
    emailHmac,
    hashPassword,
    newCorrelationHash,
    randomToken,
    tokenHmac,
    verifyPassword,
} from "@/lib/auth-crypto";
import { sendAdminLoginEmail } from "@/lib/email";
import { sanitizeUserAgent } from "@/lib/request-security";
import { Prisma } from "@prisma/client";

const VERIFICATION_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const MIN_ACCOUNT_LOOKUP_RESPONSE_MS = 1_200;
let dummyPasswordHashPromise: Promise<string> | null = null;

export function getDummyPasswordHash(): Promise<string> {
    dummyPasswordHashPromise ??= hashPassword(randomToken(18));
    return dummyPasswordHashPromise;
}

export async function waitForAccountLookupResponseFloor(startedAtMs: number): Promise<void> {
    const remainingMs = MIN_ACCOUNT_LOOKUP_RESPONSE_MS - (Date.now() - startedAtMs);
    if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
    }
}

export async function createUnverifiedUser(data: {
    emailEncrypted: string;
    emailKeyVersion: number;
    emailHmac: string;
    passwordHash: string;
}) {
    try {
        return await prisma.user.create({ data });
    } catch (error) {
        // 同一メールの並行signupは、片方を既存ユーザーと同じ応答へ収束させる。
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return null;
        }
        throw error;
    }
}

export async function recordAuthAttempt(input: {
    operation: string;
    success: boolean;
    failureReason?: string | null;
    emailHmac?: string | null;
    ipHmac?: string | null;
    userAgent?: string | null;
    correlationHash?: string;
}): Promise<string> {
    const correlationHash = input.correlationHash ?? newCorrelationHash();
    await prisma.authAttempt.create({
        data: {
            operation: input.operation,
            success: input.success,
            failureReason: input.failureReason ?? null,
            emailHmac: input.emailHmac ?? null,
            ipHmac: input.ipHmac ?? null,
            userAgent: sanitizeUserAgent(input.userAgent ?? null),
            correlationHash,
        },
    });
    return correlationHash;
}

export async function replaceVerificationToken(userId: number, now = new Date()): Promise<string> {
    const rawToken = randomToken();
    await prisma.emailVerificationToken.upsert({
        where: { userId },
        create: {
            userId,
            tokenHash: tokenHmac(rawToken),
            expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
        },
        update: {
            tokenHash: tokenHmac(rawToken),
            expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
            createdAt: now,
        },
    });
    return rawToken;
}

export async function replacePasswordResetToken(userId: number, now = new Date()): Promise<string> {
    const rawToken = randomToken();
    await prisma.passwordResetToken.upsert({
        where: { userId },
        create: {
            userId,
            tokenHash: tokenHmac(rawToken),
            expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
        },
        update: {
            tokenHash: tokenHmac(rawToken),
            csrfTokenHash: null,
            exchangedAt: null,
            expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
            createdAt: now,
        },
    });
    return rawToken;
}

export function configuredAdminEmailHmac(): string | null {
    const email = process.env.ADMIN_EMAIL;
    return email ? emailHmac(email) : null;
}

export async function maybeSendAdminLoginNotification(user: {
    id: number;
    role: number;
    emailEncrypted: string;
}, now = new Date()): Promise<void> {
    if (user.role < 10) return;
    const key = `admin-login:${user.id}`;
    const shouldSend = await prisma.$transaction(async (tx) => {
        const current = await tx.notificationThrottle.findUnique({ where: { key } });
        if (current && now.getTime() - current.lastSentAt.getTime() < 60_000) return false;
        await tx.notificationThrottle.upsert({
            where: { key },
            create: { key, lastSentAt: now },
            update: { lastSentAt: now },
        });
        return true;
    });
    if (!shouldSend) return;

    try {
        await sendAdminLoginEmail(decryptEmail(user.emailEncrypted), now);
    } catch (error) {
        console.error("Admin login notification could not be delivered.", error instanceof Error ? error.name : "UnknownError");
    }
}

export async function verifyPasswordForUser(password: string, passwordHash: string | null): Promise<boolean> {
    return verifyPassword(password, passwordHash ?? await getDummyPasswordHash());
}
