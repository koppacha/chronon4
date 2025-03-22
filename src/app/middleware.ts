import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = [
    "http://localhost:3004", // 開発環境
    "https://chrononglyph.net", // 本番環境
];

export function middleware(req: NextRequest) {
    const origin = req.headers.get("origin") || "";

    // 許可されたオリジン以外のアクセスはブロック
    if (!allowedOrigins.includes(origin)) {
        return new NextResponse("CORS Error", { status: 403 });
    }

    // CORS ヘッダーを設定
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
}

// `middleware.ts` を適用するパスを指定
export const config = {
    matcher: "/api/:path*",
};