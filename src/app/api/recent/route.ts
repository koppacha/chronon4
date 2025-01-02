import { NextResponse } from "next/server";
import { getAllPostFiles, getPostContent } from "@/lib/posts";
import matter from "gray-matter"; // mdファイルのメタデータを解析するために使用

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const nParam = searchParams.get("n");
        const mParam = searchParams.get("m");

        // デフォルト値を設定
        const n = nParam && parseInt(nParam, 10) > 0 ? parseInt(nParam, 10) : 10;
        const m = mParam && parseInt(mParam, 10) >= 0 ? parseInt(mParam, 10) : 0;

        // 全記事を取得
        const allPosts = await getAllPostFiles();

        // オフセットと取得数をもとにスライス範囲を計算
        const startIndex = allPosts.length - m - n; // 開始インデックス
        const endIndex = allPosts.length - m; // 終了インデックス

        // 範囲を適切に制限
        const validStartIndex = Math.max(startIndex, 0);
        const validEndIndex = Math.max(endIndex, 0);

        // 対象記事のスライス
        const selectedPosts = allPosts
            .slice(validStartIndex, validEndIndex)
            .reverse();

        // 記事内容とメタデータの取得
        const postsData = await Promise.all(
            selectedPosts.map(async (fileName) => {
                const content = await getPostContent(fileName);
                const { data, content: fileContent } = matter(content);

                return {
                    id: fileName,
                    title: data.title || "Untitled",
                    date: data.date || null,
                    category: data.category || null,
                    tags: data.tags || [],
                    content: fileContent,
                };
            })
        );

        return NextResponse.json(postsData, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}