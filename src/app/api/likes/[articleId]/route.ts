import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'           // prisma client を薄いラッパーで export
import { cookies } from 'next/headers'

export async function GET(
    req: Request,
    { params }: { params: { articleId: string } }
) {
    const sessionId = (await cookies()).get('next-auth.session-token')?.value ?? ''
    const { articleId } = params

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
}

export async function POST(
    req: Request,
    { params }: { params: { articleId: string } }
) {
    const sessionId = (await cookies()).get('next-auth.session-token')?.value
    if (!sessionId) return NextResponse.json({ error: 'No session' }, { status: 401 })

    const { articleId } = params

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
}