import { NextRequest, NextResponse } from "next/server";
import { getPostDetailById } from "@/lib/post-detail";
import { getLatestPublishedPostIdsFromSource } from "@/lib/post-visibility";
import { getReadStateMap } from "@/lib/read-status";
import { resolveReadActor } from "@/lib/read-actor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const rawIds = req.nextUrl.searchParams.get("ids")?.split(",") ?? [];
    const articleIds = Array.from(new Set(rawIds.filter((id) => /^\d{5}$/.test(id))));
    if (articleIds.length === 0 || articleIds.length > 500 || articleIds.length !== rawIds.length) {
        return NextResponse.json({ error: "Invalid article ids" }, { status: 400 });
    }
    const resolved = await resolveReadActor(req);
    if (!resolved) return NextResponse.json({ available: false, states: {} }, {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
    });

    const latestPublishedPostIds = await getLatestPublishedPostIdsFromSource();
    const details = await Promise.all(articleIds.map(async (id) => ({
        id,
        post: await getPostDetailById(id, resolved.role, latestPublishedPostIds),
    })));
    const readableIds = details.filter(({ post }) => post?.canViewBody).map(({ id }) => id);
    const stateMap = await getReadStateMap(resolved.actor, readableIds);
    const states = Object.fromEntries(readableIds.map((id) => [id, stateMap.get(id) ?? false]));

    return NextResponse.json({ available: true, authenticated: resolved.authenticated, states }, {
        headers: { "Cache-Control": "private, no-store" },
    });
}
