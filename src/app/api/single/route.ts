import { NextResponse } from "next/server";
import { getPostDetailById } from "@/lib/post-detail";
import { getCurrentSession } from "@/lib/auth-session";

// APIエンドポイントのメインロジック
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const n = searchParams.get("n");

        // 記事番号の検証
        if (!n || !/^\d{1,5}$/.test(n)) {
            return NextResponse.json(
                { error: "Invalid article number. Must be a number between 1 and 99999." },
                { status: 400 }
            );
        }
        const session = await getCurrentSession();
        const post = await getPostDetailById(n, session?.user.role ?? 0);
        if (!post) {
            return NextResponse.json({ error: "Article not found." }, { status: 404 });
        }
        return NextResponse.json(post, { headers: { "Cache-Control": session ? "private, no-store" : "public, max-age=0, must-revalidate" } });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
