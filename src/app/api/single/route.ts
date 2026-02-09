import { NextResponse } from "next/server";
import { join } from "path";
import fs from "fs/promises";
import matter from "gray-matter";
import {getAllPostFiles} from "@/lib/posts";
import {id2slug, formatDate} from "@/lib/chronon4";

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
        const searchTrigger = n.padStart(5, "0"); // 5桁ゼロパディング
        // 全記事を取得
        const allPosts = await getAllPostFiles();

        // ファイル検索（末尾から）
        const targetFile = allPosts.find((file) =>
            file.includes(searchTrigger)
        );

        if (!targetFile) {
            return NextResponse.json({ error: "Article not found." }, { status: 404 });
        }

        // ファイル内容を取得
        const fullPath = join("blog", targetFile);
        const fileContents = await fs.readFile(fullPath, "utf8");
        const { data, content } = matter(fileContents);
        const { postId } = id2slug(targetFile);

        // ファイルの最終更新日時を取得
        const stats = await fs.stat(fullPath);
        const lastModified = formatDate(stats.mtime);

        // JSONデータを構築して返す
        return NextResponse.json({
            id: postId || 0,
            title: data.title || null,
            date: data.date || null,
            category: data.category || data.categories || null,
            tags: data.tags || [],
            content,
            update: lastModified,
            size: content.length
        });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
