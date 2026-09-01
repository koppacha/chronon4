import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { configuredAdminEmailHmac, recordAuthAttempt } from "@/lib/auth-service";
import { newCorrelationHash, tokenHmac } from "@/lib/auth-crypto";
import { Prisma } from "@prisma/client";
import { getPublicBaseUrl } from "@/lib/public-base-url";

export const dynamic = "force-dynamic";

async function verifyUserWithReaderNumber(userId: number, adminEmailKey: string | null) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await prisma.$transaction(async (tx) => {
                const currentUser = await tx.user.findUnique({ where: { id: userId } });
                if (!currentUser) return null;
                if (currentUser.verifiedAt && currentUser.readerNumber) {
                    await tx.emailVerificationToken.deleteMany({ where: { userId: currentUser.id } });
                    return { readerNumber: currentUser.readerNumber, emailHmac: currentUser.emailHmac };
                }
                const maxReader = await tx.user.aggregate({ _max: { readerNumber: true } });
                const readerNumber = (maxReader._max.readerNumber ?? 0) + 1;
                const nextRole = adminEmailKey && currentUser.emailHmac === adminEmailKey ? 10 : 1;
                const updated = await tx.user.update({
                    where: { id: currentUser.id },
                    data: {
                        verifiedAt: new Date(),
                        readerNumber,
                        role: nextRole,
                    },
                });
                if (currentUser.role !== nextRole && nextRole >= 10) {
                    await tx.adminAuditLog.create({
                        data: {
                            userId: currentUser.id,
                            action: "grant",
                            target: `user:${currentUser.id}:role`,
                            beforeValue: String(currentUser.role),
                            afterValue: String(nextRole),
                            correlationHash: newCorrelationHash(),
                        },
                    });
                }
                await tx.emailVerificationToken.deleteMany({ where: { userId: currentUser.id } });
                return { readerNumber: updated.readerNumber, emailHmac: updated.emailHmac };
            });
        } catch (error) {
            const retryable = error instanceof Prisma.PrismaClientKnownRequestError
                && (error.code === "P2002" || error.code === "P2034");
            if (!retryable || attempt === 2) throw error;
        }
    }
    return null;
}

function welcomeRedirect(req: NextRequest, status: string, readerNumber?: number | null) {
    const url = new URL("/welcome", getPublicBaseUrl());
    url.searchParams.set("status", status);
    if (readerNumber) url.searchParams.set("readerNumber", String(readerNumber));
    const response = NextResponse.redirect(url, 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
}

export async function GET(req: NextRequest) {
    const rawToken = req.nextUrl.searchParams.get("token") ?? "";
    if (!rawToken || rawToken.length > 256) return welcomeRedirect(req, "invalid");

    try {
        const token = await prisma.emailVerificationToken.findUnique({
            where: { tokenHash: tokenHmac(rawToken) },
            include: { user: true },
        });
        if (!token) return welcomeRedirect(req, "invalid");
        if (token.expiresAt <= new Date()) {
            await prisma.emailVerificationToken.delete({ where: { id: token.id } });
            await recordAuthAttempt({ operation: "verify-email", success: false, failureReason: "expired", emailHmac: token.user.emailHmac });
            return welcomeRedirect(req, "expired");
        }

        const adminEmailKey = configuredAdminEmailHmac();
        const result = await verifyUserWithReaderNumber(token.userId, adminEmailKey);

        if (!result) return welcomeRedirect(req, "invalid");
        await recordAuthAttempt({ operation: "verify-email", success: true, emailHmac: result.emailHmac });
        return welcomeRedirect(req, "success", result.readerNumber);
    } catch (error) {
        console.error("Email verification failed.", error instanceof Error ? error.name : "UnknownError");
        return welcomeRedirect(req, "error");
    }
}
