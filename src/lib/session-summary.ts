import "server-only";

import prisma from "@/lib/prisma";
import { decryptEmail } from "@/lib/auth-crypto";
import { getCurrentSession } from "@/lib/auth-session";
import { getActiveReadSummary, userReadActor } from "@/lib/read-status";

export type SessionSummary = {
    authenticated: boolean;
    unavailable?: boolean;
    displayName?: string;
    role?: number;
    likeCount?: number;
    readCount?: number;
    lastRead?: { articleId: string; date: string } | null;
};

function displayName(handleName: string | null, emailEncrypted: string): string {
    if (handleName?.trim()) return handleName.trim();
    const local = decryptEmail(emailEncrypted).split("@", 1)[0] ?? "読者";
    return local.split("+", 1)[0] || "読者";
}

export async function getSessionSummary(): Promise<SessionSummary> {
    let session;
    try {
        session = await getCurrentSession();
    } catch (error) {
        console.error("Failed to load current session:", error);
        return { authenticated: false, unavailable: true };
    }

    if (!session) return { authenticated: false };

    const [likeResult, readResult] = await Promise.allSettled([
        prisma.userLike.count({ where: { userId: session.user.id, active: true } }),
        getActiveReadSummary(userReadActor(session.user.id), 1),
    ]);

    if (likeResult.status === "rejected") {
        console.error("Failed to load user like summary:", likeResult.reason);
    }
    if (readResult.status === "rejected") {
        console.error("Failed to load user read summary:", readResult.reason);
    }

    const readSummary = readResult.status === "fulfilled" ? readResult.value : null;
    return {
        authenticated: true,
        displayName: displayName(session.user.handleName, session.user.emailEncrypted),
        role: session.user.role,
        likeCount: likeResult.status === "fulfilled" ? likeResult.value : undefined,
        readCount: readSummary?.count,
        lastRead: readSummary?.recent[0]
            ? {
                articleId: readSummary.recent[0].articleId,
                date: readSummary.recent[0].createdAt.toISOString(),
            }
            : null,
    };
}
