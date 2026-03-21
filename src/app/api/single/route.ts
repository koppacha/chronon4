import { NextResponse } from "next/server";
import { getPostDetailById } from "@/lib/post-detail";

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
        const post = await getPostDetailById(n);
        if (!post) {
            return NextResponse.json({ error: "Article not found." }, { status: 404 });
        }
        return NextResponse.json(post);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
