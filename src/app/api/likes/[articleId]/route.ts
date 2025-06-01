import { NextResponse, NextRequest } from 'next/server'
import prisma from '@/lib/prisma'           // prisma client を薄いラッパーで export
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

type RouteContext = {
    params: Promise<{ articleId: string }>
}
export async function GET(
    req: NextRequest,
    { params }: RouteContext
) {
    try {
        const sessionId = (await cookies()).get('access_id')?.value ?? ''
        const { articleId } = await params

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

        const { articleId } = await params

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
        console.error(e)
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Unknown error' },
            { status: 500 }
        )
    }
}