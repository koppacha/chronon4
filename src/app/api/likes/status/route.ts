import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth-session";
import { getPostDetailById } from "@/lib/post-detail";
import { getLatestPublishedPostIdsFromSource } from "@/lib/post-visibility";
import { isValidAnonymousSessionId } from "@/lib/anonymous-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const requestedIds = Array.from(new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean)));
    if (requestedIds.length > 100 || requestedIds.some((id) => !/^\d{5}$/.test(id))) {
        return NextResponse.json({ error: "Invalid article ids" }, { status: 400 });
    }

    const session = await getCurrentSession();
    const latestIds = await getLatestPublishedPostIdsFromSource();
    const posts = await Promise.all(requestedIds.map(async (id) => ({
        id,
        post: await getPostDetailById(id, session?.user.role ?? 0, latestIds),
    })));
    const articleIds = posts.filter(({ post }) => post?.canViewBody).map(({ id }) => id);
    if (articleIds.length === 0) {
        return NextResponse.json({ authenticated: Boolean(session), states: {} }, {
            headers: { "Cache-Control": "private, no-store" },
        });
    }

    const rawAnonymousSessionId = session ? "" : req.cookies.get("access_id")?.value;
    const anonymousSessionId = isValidAnonymousSessionId(rawAnonymousSessionId) ? rawAnonymousSessionId : "";
    const [anonymousCounts, userCounts, anonymousLikes, userLikes] = await Promise.all([
        prisma.like.groupBy({ by: ["articleId"], where: { articleId: { in: articleIds }, flag: false }, _count: { _all: true } }),
        prisma.userLike.groupBy({ by: ["articleId"], where: { articleId: { in: articleIds }, active: true }, _count: { _all: true } }),
        anonymousSessionId ? prisma.like.findMany({ where: { articleId: { in: articleIds }, sessionId: anonymousSessionId, flag: false }, select: { articleId: true } }) : [],
        session ? prisma.userLike.findMany({ where: { articleId: { in: articleIds }, userId: session.user.id, active: true }, select: { articleId: true } }) : [],
    ]);
    const anonymousCountById = new Map(anonymousCounts.map((item) => [item.articleId, item._count._all]));
    const userCountById = new Map(userCounts.map((item) => [item.articleId, item._count._all]));
    const likedIds = new Set((session ? userLikes : anonymousLikes).map((item) => item.articleId));
    const states = Object.fromEntries(articleIds.map((id) => [id, {
        count: (anonymousCountById.get(id) ?? 0) + (userCountById.get(id) ?? 0),
        liked: likedIds.has(id),
    }]));

    return NextResponse.json({ authenticated: Boolean(session), states }, {
        headers: { "Cache-Control": "private, no-store" },
    });
}
