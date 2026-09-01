import { NextRequest, NextResponse } from "next/server";
import { getPostDetailById } from "@/lib/post-detail";
import { readJsonObject, sanitizeReferer } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import { resolveReadActor, validateReadMutation } from "@/lib/read-actor";
import { appendReadAction, getReadState } from "@/lib/read-status";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ articleId: string }> };
const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: RouteContext) {
    const { articleId } = await params;
    if (!/^\d{5}$/.test(articleId)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    const resolved = await resolveReadActor(req);
    if (!resolved) return NextResponse.json({ available: false, read: false }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const post = await getPostDetailById(articleId, resolved.role);
    if (!post) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (!post.canViewBody) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
        available: true,
        authenticated: resolved.authenticated,
        read: await getReadState(resolved.actor, articleId),
    }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
    const validated = await validateReadMutation(req);
    if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: validated.status });
    const { articleId } = await params;
    if (!/^\d{5}$/.test(articleId)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
    const post = await getPostDetailById(articleId, validated.value.role);
    if (!post) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (!post.canViewBody) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const actor = validated.value.actor;
    let action: { eventId: string; isRead: boolean; source: "automatic" | "manual" };
    try {
        const body = await readJsonObject(req);
        const eventId = typeof body.eventId === "string" ? body.eventId : "";
        const source = body.source === "automatic" || body.source === "manual" ? body.source : null;
        if (!EVENT_ID_PATTERN.test(eventId) || typeof body.isRead !== "boolean" || !source) {
            return NextResponse.json({ error: "Invalid read action" }, { status: 400 });
        }
        action = { eventId, isRead: body.isRead, source };
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const limits = actor.type === "user"
        ? [{ operation: "read_action", identifierHashes: [`user:${actor.id}`], limit: 300 }]
        : [
            { operation: "anonymous_read_global", identifierHashes: ["global"], limit: 3_000 },
            { operation: "anonymous_read_session", identifierHashes: [`anonymous:${actor.id}`], limit: 120 },
        ];
    for (const rule of limits) {
        const limit = await consumeRateLimit({ ...rule, windowMs: 24 * 60 * 60 * 1000, blockMs: 60 * 60 * 1000 });
        if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, {
            status: 429,
            headers: { "Retry-After": String(limit.retryAfterSeconds) },
        });
    }

    try {
        const read = await appendReadAction({
            actor,
            articleId,
            eventId: action.eventId,
            isRead: action.isRead,
            source: action.source,
            referer: sanitizeReferer(req.headers.get("referer")),
        });
        return NextResponse.json({ ok: true, read, authenticated: validated.value.authenticated });
    } catch (error) {
        console.error("Read action update failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "既読状態を更新できませんでした。" }, { status: 500 });
    }
}
