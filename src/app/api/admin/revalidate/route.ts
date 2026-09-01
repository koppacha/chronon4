import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { newCorrelationHash } from "@/lib/auth-crypto";
import { validateAuthenticatedMutation } from "@/lib/auth-session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { revalidateSiteContent } from "@/lib/site-revalidation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await validateAuthenticatedMutation(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.session.user.role < 10) return NextResponse.json({ error: "Administrator role required." }, { status: 403 });

    const limit = await consumeRateLimit({
        operation: "admin_revalidate",
        identifierHashes: [`user:${auth.session.user.id}`],
        limit: 10,
        windowMs: 10 * 60 * 1000,
        blockMs: 10 * 60 * 1000,
    });
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });

    try {
        const paths = revalidateSiteContent();
        await prisma.adminAuditLog.create({
            data: {
                userId: auth.session.user.id,
                action: "revalidate",
                target: "site_content",
                afterValue: JSON.stringify({ paths }),
                correlationHash: newCorrelationHash(),
            },
        });
        return NextResponse.json({ ok: true, revalidated: true, paths });
    } catch (error) {
        console.error("Manual revalidation failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "記事とキャッシュを更新できませんでした。" }, { status: 500 });
    }
}
