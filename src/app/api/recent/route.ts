import { NextResponse } from "next/server";
import {getAllPostFiles, getPostContent, postsDirectory} from "@/lib/posts";
import matter from "gray-matter";
import {id2slug, formatDate} from "@/lib/chronon4";
import fs from "fs/promises";
import path from "path";

const MAX_N = 100;
const MAX_M = 5000;
const MAX_CONCURRENCY = 8;
const VALID_FIELDS = new Set(["t", "d", "c", "g", "n", "u", "s"]);

async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const current = index;
            index += 1;
            results[current] = await mapper(items[current], current);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

export async function GET(req: Request) {

    try {
        const { searchParams } = new URL(req.url);
        const nParam = searchParams.get("n");
        const mParam = searchParams.get("m");
        const aParam = searchParams.get("a");
        const fParam = searchParams.get("f");

        // デフォルト値を設定
        const n = nParam && /^\d+$/.test(nParam) ? Number.parseInt(nParam, 10) : 10;
        const m = mParam && /^\d+$/.test(mParam) ? Number.parseInt(mParam, 10) : 0;
        const a = aParam && /^\d+$/.test(aParam) ? Number.parseInt(aParam, 10) : null;

        if (n < 1 || n > MAX_N) {
            return NextResponse.json({ error: `n must be between 1 and ${MAX_N}` }, { status: 400 });
        }
        if (m < 0 || m > MAX_M) {
            return NextResponse.json({ error: `m must be between 0 and ${MAX_M}` }, { status: 400 });
        }
        if (a !== null && a < 1) {
            return NextResponse.json({ error: "a must be greater than or equal to 1" }, { status: 400 });
        }
        if (fParam && !/^[tdcgnus]+$/.test(fParam)) {
            return NextResponse.json({ error: "f contains unsupported fields" }, { status: 400 });
        }

        // 全記事を取得
        const allPosts = await getAllPostFiles();
        if (!allPosts || allPosts.length === 0) {
            return NextResponse.json({ error: "No posts found" }, { status: 404 });
        }
        const totalPosts = allPosts.length;

        // 開始インデックス
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
        const allowedFields = new Set((fParam ? fParam.split("") : []).filter((field) => VALID_FIELDS.has(field)));
        const includeField = (field: string) => allowedFields.has(field) || !fParam;

        // 記事内容とメタデータの取得
        const postsData = await mapWithConcurrency(
            selectedPosts,
            MAX_CONCURRENCY,
            async (fileName) => {
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
                if (includeField('u')) {
                    const filePath = path.join(postsDirectory, fileName);
                    const stats = await fs.stat(filePath);
                    result.update = formatDate(stats.mtime);
                }
                if (includeField('s')) result.size = fileContent.length;

                return result;
            }
        );

        // null のデータを除外
        const filteredPosts = postsData.filter((post) => post !== null);

        if (filteredPosts.length === 0) {
            return NextResponse.json({ error: "No valid posts found" }, { status: 404 });
        }

        return NextResponse.json(filteredPosts, {
            status: 200,
            headers: {
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
