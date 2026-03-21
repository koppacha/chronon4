import matter from "gray-matter";
import fs from "fs/promises";
import path from "path";
import { getAllPostFiles, getPostContent, postsDirectory } from "@/lib/posts";
import { formatDate, id2slug } from "@/lib/chronon4";

const MAX_N = 100;
const MAX_M = 5000;
const MAX_CONCURRENCY = 8;
const VALID_FIELDS = new Set(["t", "d", "c", "g", "n", "u", "s"]);

type RecentPostField = "t" | "d" | "c" | "g" | "n" | "u" | "s";

export type RecentPostData = {
    id: string;
    title?: string;
    date?: string | null;
    category?: string | null;
    tags?: string[];
    content?: string;
    update?: string;
    size?: number;
};

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

export async function getRecentPostsData(options?: {
    n?: number;
    m?: number;
    a?: number | null;
    f?: string | null;
}): Promise<RecentPostData[]> {
    const n = options?.n ?? 10;
    const m = options?.m ?? 0;
    const a = options?.a ?? null;
    const fParam = options?.f ?? null;

    if (n < 1 || n > MAX_N) {
        throw new Error(`n must be between 1 and ${MAX_N}`);
    }
    if (m < 0 || m > MAX_M) {
        throw new Error(`m must be between 0 and ${MAX_M}`);
    }
    if (a !== null && a < 1) {
        throw new Error("a must be greater than or equal to 1");
    }
    if (fParam && !/^[tdcgnus]+$/.test(fParam)) {
        throw new Error("f contains unsupported fields");
    }

    const allPosts = await getAllPostFiles();
    if (!allPosts || allPosts.length === 0) {
        return [];
    }
    const totalPosts = allPosts.length;

    const startIndex = (a !== null && a >= 1 && a <= totalPosts)
        ? Math.max(a - m, 1) - 1
        : totalPosts - m - n;
    const endIndex = (a !== null && a >= 1 && a <= totalPosts)
        ? Math.min(a + n - m, totalPosts)
        : totalPosts - m;

    const validStartIndex = Math.max(startIndex, 0);
    const validEndIndex = Math.max(endIndex, 0);

    const selectedPosts = allPosts
        .slice(validStartIndex, validEndIndex)
        .reverse();

    if (selectedPosts.length === 0) {
        return [];
    }

    const allowedFields = new Set(
        (fParam ? fParam.split("") : []).filter((field) => VALID_FIELDS.has(field))
    );
    const includeField = (field: RecentPostField) => allowedFields.has(field) || !fParam;

    const postsData = await mapWithConcurrency(
        selectedPosts,
        MAX_CONCURRENCY,
        async (fileName) => {
            const content = await getPostContent(fileName);
            if (!content) return null;

            const { data, content: fileContent } = matter(content);
            const { postId } = id2slug(fileName);

            const result: RecentPostData = { id: postId };

            if (includeField("t")) result.title = data.title || "Untitled";
            if (includeField("d")) result.date = data.date || null;
            if (includeField("c")) result.category = data.category || null;
            if (includeField("g")) result.tags = data.tags || [];
            if (includeField("n")) result.content = fileContent;
            if (includeField("u")) {
                const filePath = path.join(postsDirectory, fileName);
                const stats = await fs.stat(filePath);
                result.update = formatDate(stats.mtime);
            }
            if (includeField("s")) result.size = fileContent.length;

            return result;
        }
    );

    return postsData.filter(Boolean);
}
