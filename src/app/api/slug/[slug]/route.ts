import { NextResponse } from "next/server";
import { join } from "path";
import fs from "fs";
import matter from "gray-matter";

// 現在のファイルのディレクトリを基準に posts のパスを設定
const postsDirectory = join(process.cwd(), "blog");

export async function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        console.log(slug)
        const realSlug = slug.replace(/\.md$/, "");
        const year = slug.split("-")[0];
        const month = slug.split("-")[1];
        const fullPath = join(postsDirectory, year, month, `${realSlug}.md`);

        // ファイルが存在するか確認
        if (!fs.existsSync(fullPath)) {
            return NextResponse.json({ error: `Post not found: ${fullPath}` }, { status: 404 });
        }

        // ファイル内容を読み込む
        const fileContents = fs.readFileSync(fullPath, "utf8");
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