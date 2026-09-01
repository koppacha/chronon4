import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSession, validateAuthenticatedMutation } from "@/lib/auth-session";
import { getPostDetailById } from "@/lib/post-detail";
import { safeStringEqual } from "@/lib/auth-crypto";
import { validateMutationRequest } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import { toggleAnonymousLike, toggleUserLike } from "@/lib/like-service";
import { isValidAnonymousSessionId } from "@/lib/anonymous-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ articleId: string }> };
const ANON_CSRF_COOKIE = process.env.NODE_ENV === "production" ? "__Host-anon_csrf" : "anon_csrf";

async function contextForArticle(articleId: string) {
    const session = await getCurrentSession();
    const post = await getPostDetailById(articleId, session?.user.role ?? 0);
    return { session, post };
}

async function likeResponseState(articleId: string, userId?: number, anonymousSessionId?: string) {
    const [anonymousCount, userCount, userLike, anonymousLike] = await Promise.all([
        prisma.like.count({ where: { articleId, flag: false } }),
        prisma.userLike.count({ where: { articleId, active: true } }),
        userId ? prisma.userLike.findUnique({ where: { userId_articleId: { userId, articleId } } }) : null,
        anonymousSessionId ? prisma.like.findUnique({ where: { articleId_sessionId: { articleId, sessionId: anonymousSessionId } } }) : null,
    ]);
    return {
        count: anonymousCount + userCount,
        liked: userId ? Boolean(userLike?.active) : Boolean(anonymousLike && !anonymousLike.flag),
    };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
    try {
        const { articleId } = await params;
        if (!/^\d{5}$/.test(articleId)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
        const { session, post } = await contextForArticle(articleId);
        if (!post) return NextResponse.json({ error: "Article not found" }, { status: 404 });
        if (!post.canViewBody) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const [anonymousCount, userCount, anonymousLike, userLike] = await Promise.all([
            prisma.like.count({ where: { articleId, flag: false } }),
            prisma.userLike.count({ where: { articleId, active: true } }),
            session ? null : (() => {
                const sessionId = _req.cookies.get("access_id")?.value;
                return isValidAnonymousSessionId(sessionId) ? prisma.like.findFirst({
                    where: { articleId, sessionId, flag: false },
                }) : null;
            })(),
            session ? prisma.userLike.findUnique({
                where: { userId_articleId: { userId: session.user.id, articleId } },
            }) : null,
        ]);
        return NextResponse.json({
            count: anonymousCount + userCount,
            liked: session ? Boolean(userLike?.active) : Boolean(anonymousLike),
            authenticated: Boolean(session),
        }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Like lookup failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "Like storage is unavailable." }, { status: 503 });
    }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
    try {
        const { articleId } = await params;
        if (!/^\d{5}$/.test(articleId)) return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
        const session = await getCurrentSession();
        if (session) {
            const auth = await validateAuthenticatedMutation(req);
            if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
        } else {
            const requestCheck = validateMutationRequest(req);
            if ("error" in requestCheck) return NextResponse.json({ error: requestCheck.error }, { status: requestCheck.status });
            const csrfCookie = req.cookies.get(ANON_CSRF_COOKIE)?.value ?? "";
            const csrfHeader = req.headers.get("x-csrf-token") ?? "";
            if (!csrfCookie || !csrfHeader || !safeStringEqual(csrfCookie, csrfHeader)) {
                return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
            }
        }

        const post = await getPostDetailById(articleId, session?.user.role ?? 0);
        if (!post) return NextResponse.json({ error: "Article not found" }, { status: 404 });
        if (!post.canViewBody) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        if (session) {
            const limit = await consumeRateLimit({
                operation: "user_like",
                identifierHashes: [`user:${session.user.id}`],
                limit: 120,
                windowMs: 10 * 60 * 1000,
                blockMs: 10 * 60 * 1000,
            });
            if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, {
                status: 429,
                headers: { "Retry-After": String(limit.retryAfterSeconds) },
            });
            await toggleUserLike(session.user.id, articleId);
            const state = await likeResponseState(articleId, session.user.id);
            return NextResponse.json({ ok: true, ...state });
        } else {
            const sessionId = req.cookies.get("access_id")?.value;
            if (!isValidAnonymousSessionId(sessionId)) return NextResponse.json({ error: "No anonymous session" }, { status: 401 });
            const globalLimit = await consumeRateLimit({
                operation: "anonymous_like_global",
                identifierHashes: ["global"],
                limit: 1_000,
                windowMs: 10 * 60 * 1000,
                blockMs: 10 * 60 * 1000,
            });
            const sessionLimit = await consumeRateLimit({
                operation: "anonymous_like_session",
                identifierHashes: [`anonymous:${sessionId}`],
                limit: 30,
                windowMs: 10 * 60 * 1000,
                blockMs: 10 * 60 * 1000,
            });
            const limit = globalLimit.allowed ? sessionLimit : globalLimit;
            if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, {
                status: 429,
                headers: { "Retry-After": String(limit.retryAfterSeconds) },
            });
            await toggleAnonymousLike(sessionId, articleId);
            const state = await likeResponseState(articleId, undefined, sessionId);
            return NextResponse.json({ ok: true, ...state });
        }
    } catch (error) {
        console.error("Like update failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "Like storage is unavailable." }, { status: 503 });
    }
}
