import { NextResponse } from "next/server";
import { getAllPostFiles, getPostContent } from "@/lib/posts";
import matter from "gray-matter";
import {id2slug} from "@/lib/chronon4"; // mdファイルのメタデータを解析するために使用

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const nParam = searchParams.get("n");
        const mParam = searchParams.get("m");
        const aParam = searchParams.get("a");
        const fParam = searchParams.get("f");

        // デフォルト値を設定
        const n = nParam && parseInt(nParam, 10) > 0 ? parseInt(nParam, 10) : 10;
        const m = mParam && parseInt(mParam, 10) >= 0 ? parseInt(mParam, 10) : 0;

        // 全記事を取得
        const allPosts = await getAllPostFiles();
        if (!allPosts || allPosts.length === 0) {
            return NextResponse.json({ error: "No posts found" }, { status: 404 });
        }
        const totalPosts = allPosts.length;

        // 開始インデックス
        const a = aParam && parseInt(aParam, 10);
        const startIndex = (a >= 1 && a <= totalPosts) ?
            Math.max(a - m, 1) - 1 :
            totalPosts - m - n;

        // 終了インデックス
        const endIndex = (a >= 1 && a <= totalPosts) ?
            Math.min(a + n - m, totalPosts) :
            totalPosts - m;

        // 範囲を適切に制限
        const validStartIndex = Math.max(startIndex, 0);
        const validEndIndex = Math.max(endIndex, 0);

        // 対象記事のスライス
        const selectedPosts = allPosts
            .slice(validStartIndex, validEndIndex)
            .reverse();

        if (selectedPosts.length === 0) {
            return NextResponse.json({ error: "No matching posts found" }, { status: 404 });
        }

        // `f` パラメータで指定されたデータを抽出
        const allowedFields = new Set(fParam ? fParam.split('') : []);
        const includeField = (field: string) => allowedFields.has(field) || !fParam;

        // 記事内容とメタデータの取得
        const postsData = await Promise.all(
            selectedPosts.map(async (fileName) => {
                const content = await getPostContent(fileName);
                if (!content) return null;

                const { data, content: fileContent } = matter(content);
                const { postId } = id2slug(fileName);

                // id は常に含める
                const result: Record<string, any> = { id: postId };

                if (includeField('t')) result.title = data.title || "Untitled";
                if (includeField('d')) result.date = data.date || null;
                if (includeField('c')) result.category = data.category || null;
                if (includeField('g')) result.tags = data.tags || [];
                if (includeField('n')) result.content = fileContent;

                return result;
            })
        );

        // null のデータを除外
        const filteredPosts = postsData.filter((post) => post !== null);

        if (filteredPosts.length === 0) {
            return NextResponse.json({ error: "No valid posts found" }, { status: 404 });
        }

        return NextResponse.json(filteredPosts, { status: 200 });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}