// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

/* ---------- 共通設定 ---------- */

const allowedOrigins = new Set<string>()
if (process.env.NEXT_PUBLIC_BASE_URL) {
    try {
        allowedOrigins.add(new URL(process.env.NEXT_PUBLIC_BASE_URL).origin)
    } catch {
        // 不正な本番設定はAPIのOrigin検査をfail closedにする。
    }
}
if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:3004')
    allowedOrigins.add('http://127.0.0.1:3004')
}

const COOKIE_NAME = 'access_id'
const ANON_CSRF_COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-anon_csrf' : 'anon_csrf'
const ONE_YEAR   = 60 * 60 * 24 * 365   // 秒

/* ---------- ミドルウェア本体 ---------- */
export function middleware(req: NextRequest) {
    if (req.method === 'OPTIONS' && req.nextUrl.pathname.startsWith('/api/')) {
        const origin = req.headers.get('origin') || ''
        if (origin && !allowedOrigins.has(origin)) {
            return new NextResponse('CORS Error', { status: 403 })
        }
        const preflight = new NextResponse(null, { status: 204 })
        if (origin) {
            preflight.headers.set('Access-Control-Allow-Origin', origin)
            preflight.headers.set('Vary', 'Origin')
        }
        preflight.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        preflight.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
        return preflight
    }

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
    if (!req.cookies.get(ANON_CSRF_COOKIE_NAME)) {
        res.cookies.set({
            name: ANON_CSRF_COOKIE_NAME,
            value: crypto.randomUUID(),
            httpOnly: false,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            maxAge: ONE_YEAR
        })
    }

    /* --- ② API パスだけ CORS ヘッダー処理 --- */
    if (req.nextUrl.pathname.startsWith('/api/')) {
        const origin = req.headers.get('origin') || ''
        if (origin && !allowedOrigins.has(origin)) {
            return new NextResponse('CORS Error', { status: 403 })
        }
        if (origin) {
            res.headers.set('Access-Control-Allow-Origin', origin)
            res.headers.set('Vary', 'Origin')
        }
        res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
    }

    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.headers.set('X-Frame-Options', 'DENY')
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    const scriptSrc = process.env.NODE_ENV === 'production'
        ? "'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com"
        : "'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com"
    res.headers.set('Content-Security-Policy', [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "frame-src https://www.youtube.com",
        "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
    ].join('; '))
    if (process.env.NODE_ENV === 'production') {
        res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    if (
        req.nextUrl.pathname === '/login' ||
        req.nextUrl.pathname === '/welcome' ||
        req.nextUrl.pathname === '/password-reset' ||
        req.nextUrl.pathname === '/config' ||
        req.nextUrl.pathname.startsWith('/api/auth/') ||
        req.nextUrl.pathname.startsWith('/api/user/') ||
        req.nextUrl.pathname.startsWith('/api/admin/')
    ) {
        res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
        res.headers.set('Cache-Control', 'private, no-store')
        res.headers.set('Referrer-Policy', 'no-referrer')
    }

    return res
}

/* ---------- どのパスで実行するか ---------- */
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon|robots.txt|sitemap.xml|rss.xml).*)']
}
