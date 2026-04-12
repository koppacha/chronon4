import { getArchivePostFullList, getVisibleArchivePostMeta } from "@/lib/archive";

const MAX_N = 100;
const MAX_M = 5000;
const VALID_FIELDS = new Set(["t", "d", "c", "g", "n", "u", "s"]);

type RecentPostField = "t" | "d" | "c" | "g" | "n" | "u" | "s";

export type RecentPostData = {
    id: string;
    fileName?: string;
    title?: string;
    date?: string | null;
    category?: string | null;
    tags?: string[];
    content?: string;
    update?: string;
    size?: number;
    sourceMtimeMs?: number;
};

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

    const allPosts = (await getVisibleArchivePostMeta()).sort((a, b) => a.id - b.id);
    if (allPosts.length === 0) {
        return [];
    }

    const allowedFields = new Set(
        (fParam ? fParam.split("") : []).filter((field) => VALID_FIELDS.has(field))
    );
    const includeField = (field: RecentPostField) => allowedFields.has(field) || !fParam;
    const totalPosts = allPosts.length;

    let selectedPosts = allPosts;
    if (a !== null) {
        const anchorIndex = allPosts.findIndex((post) => post.id === a);
        if (anchorIndex === -1) {
            return [];
        }

        const startIndex = Math.max(anchorIndex - m, 0);
        const endIndex = Math.min(anchorIndex + (n - m), totalPosts);
        selectedPosts = allPosts.slice(startIndex, endIndex).reverse();
    } else {
        selectedPosts = [...allPosts].reverse().slice(m, m + n);
    }

    if (selectedPosts.length === 0) {
        return [];
    }

    const fullPostsById = (includeField("n") || includeField("u") || includeField("s"))
        ? new Map(
            (await getArchivePostFullList(selectedPosts)).map((post) => [post.id, post])
        )
        : null;

    return selectedPosts.map((post) => {
        const full = fullPostsById?.get(post.idString);
        const result: RecentPostData = {
            id: post.idString,
            fileName: post.fileName,
        };

        if (includeField("t")) result.title = post.title || "Untitled";
        if (includeField("d")) result.date = post.date || null;
        if (includeField("c")) result.category = post.categories[0] || null;
        if (includeField("g")) result.tags = post.tags || [];
        if (includeField("n")) result.content = full?.content ?? "";
        if (includeField("u")) result.update = full?.update ?? "";
        if (includeField("s")) result.size = full?.size ?? 0;
        if (full) result.sourceMtimeMs = full.sourceMtimeMs;

        return result;
    });
}
