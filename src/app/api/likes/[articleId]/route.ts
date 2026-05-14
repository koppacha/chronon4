import { NextResponse, NextRequest } from 'next/server'
import prisma from '@/lib/prisma'           // prisma client を薄いラッパーで export
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

type RouteContext = {
    params: Promise<{ articleId: string }>
}

function isPrismaStorageUnavailable(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    const code = 'code' in error ? (error as { code?: unknown }).code : undefined
    if (code === 'P2021' || code === 'P2022' || code === 'P1003') return true

    const message = error instanceof Error ? error.message : ''
    return (
        message.includes('does not exist in the current database') ||
        message.includes('no such table') ||
        message.includes('Unable to open the database file')
    )
}

function unavailableGetResponse() {
    return NextResponse.json({
        count: 0,
        liked: false,
        unavailable: true,
    })
}

function unavailablePostResponse() {
    return NextResponse.json(
        {
            ok: false,
            unavailable: true,
            error: 'Like storage is unavailable.',
        },
        { status: 503 }
    )
}

export async function GET(
    req: NextRequest,
    { params }: RouteContext
) {
    try {
        const sessionId = (await cookies()).get('access_id')?.value ?? ''
        const { articleId } = await params
        if (!/^\d{5}$/.test(articleId)) {
            return NextResponse.json({ error: 'Invalid article id' }, { status: 400 })
        }

        // 有効いいね数
        const count = await prisma.like.count({
            where: { articleId, flag: false }
        })

        // 現ユーザーがいいね済みか？
        const liked = sessionId
            ? await prisma.like.findFirst({
                where: { articleId, sessionId, flag: false }
            })
            : null

        return NextResponse.json({ count, liked: !!liked })
    } catch (e) {
        if (isPrismaStorageUnavailable(e)) {
            console.error('Like storage unavailable:', e)
            return unavailableGetResponse()
        }

        console.error(e)
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

export async function POST(
    req: NextRequest,
    { params }: RouteContext
) {
    try {
        const sessionId = (await cookies()).get('access_id')?.value
        if (!sessionId) return NextResponse.json({ error: 'No session' }, { status: 401 })
        if (sessionId.length > 128) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
        }

        const { articleId } = await params
        if (!/^\d{5}$/.test(articleId)) {
            return NextResponse.json({ error: 'Invalid article id' }, { status: 400 })
        }

        // 既に有効いいねがあるか判定
        const existing = await prisma.like.findFirst({
            where: { articleId, sessionId, flag: false }
        })

        if (existing) {
            // いいね取り消し → flag を true に
            await prisma.like.update({
                where: { id: existing.id },
                data: { flag: true }
            })
        } else {
            // いいね登録
            await prisma.like.create({
                data: { articleId, sessionId, flag: false }
            })
        }

        return NextResponse.json({ ok: true })
    } catch (e) {
        if (isPrismaStorageUnavailable(e)) {
            console.error('Like storage unavailable:', e)
            return unavailablePostResponse()
        }

        console.error(e)
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
