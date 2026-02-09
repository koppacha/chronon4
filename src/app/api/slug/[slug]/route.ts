import { NextRequest, NextResponse } from "next/server";
import { join, resolve, sep } from "path";
import fs from "fs/promises";
import matter from "gray-matter";

// 現在のファイルのディレクトリを基準に posts のパスを設定
const postsDirectory = join(process.cwd(), "blog");
const SLUG_PATTERN = /^\d{4}-\d{2}-\d{2}-\d{5}$/;

export async function GET(request: NextRequest, { params }: {params: Promise<{ slug: string }> }): Promise<NextResponse> {
    try {
        const { slug } = await params;
        const realSlug = slug.replace(/\.md$/, "");
        if (!SLUG_PATTERN.test(realSlug)) {
            return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
        }

        const year = slug.split("-")[0];
        const month = slug.split("-")[1];
        const fullPath = resolve(postsDirectory, year, month, `${realSlug}.md`);
        const postsRoot = resolve(postsDirectory);
        if (!(fullPath === postsRoot || fullPath.startsWith(postsRoot + sep))) {
            return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        }

        // ファイルが存在するか確認
        try {
            await fs.access(fullPath);
        } catch {
            return NextResponse.json({ error: `Post not found: ${slug}` }, { status: 404 });
        }

        // ファイル内容を読み込む
        const fileContents = await fs.readFile(fullPath, "utf8");
        const { data, content } = matter(fileContents);

        // レスポンスを返す
        return NextResponse.json(
            {
                ...data,
                slug: realSlug,
                content,
            },
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=3600", // 1時間のキャッシュを許可
                },
            }
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
