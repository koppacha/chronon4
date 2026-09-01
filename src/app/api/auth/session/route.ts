import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptEmail } from "@/lib/auth-crypto";
import { getCurrentSession } from "@/lib/auth-session";
import { getActiveReadSummary, userReadActor } from "@/lib/read-status";

export const dynamic = "force-dynamic";

function displayName(handleName: string | null, emailEncrypted: string): string {
    if (handleName?.trim()) return handleName.trim();
    const local = decryptEmail(emailEncrypted).split("@", 1)[0] ?? "読者";
    return local.split("+", 1)[0] || "読者";
}

export async function GET() {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ authenticated: false }, {
            headers: { "Cache-Control": "private, no-store" },
        });
    }

    const [likeCount, readSummary] = await Promise.all([
        prisma.userLike.count({ where: { userId: session.user.id, active: true } }),
        getActiveReadSummary(userReadActor(session.user.id), 1),
    ]);

    return NextResponse.json({
        authenticated: true,
        displayName: displayName(session.user.handleName, session.user.emailEncrypted),
        role: session.user.role,
        likeCount,
        readCount: readSummary.count,
        lastRead: readSummary.recent[0]
            ? { articleId: readSummary.recent[0].articleId, date: readSummary.recent[0].createdAt.toISOString() }
            : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
}
