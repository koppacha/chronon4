// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'

/* ---------- 共通設定 ---------- */

const allowedOrigins = [
    'http://localhost:3004',     // 開発
    'https://chrononglyph.net'   // 本番
]

const COOKIE_NAME = 'access_id'
const ONE_YEAR   = 60 * 60 * 24 * 365   // 秒

/* ---------- ミドルウェア本体 ---------- */
export function middleware(req: NextRequest) {
    const res = NextResponse.next()

    /* --- ① まだユーザーID が無ければ発行 --- */
    if (!req.cookies.get(COOKIE_NAME)) {
        const anonId = crypto.randomUUID()
        res.cookies.set({
            name:     COOKIE_NAME,
            value:    anonId,
            httpOnly: true,
            sameSite: 'lax',
            path:     '/',
            secure:   process.env.NODE_ENV === 'production',
            maxAge:   ONE_YEAR
        })
    }

    /* --- ② API パスだけ CORS ヘッダー処理 --- */
    if (req.nextUrl.pathname.startsWith('/api/')) {
        const origin = req.headers.get('origin') || ''
        if (origin && !allowedOrigins.includes(origin)) {
            return new NextResponse('CORS Error', { status: 403 })
        }
        res.headers.set('Access-Control-Allow-Origin',  origin)
        res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }

    return res
}

/* ---------- どのパスで実行するか ---------- */
export const config = {
    matcher: ['/', '/(.*)']   // = 全リクエストに適用
}