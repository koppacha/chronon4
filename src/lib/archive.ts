import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { getAllPostFiles, postsDirectory } from "@/lib/posts";
import { getCache, setCache } from "@/lib/cache";
import { formatDate, id2slug } from "@/lib/chronon4";
import { tagToUrlKey } from "@/lib/tag-url";

const ARCHIVE_META_CACHE_KEY = "archivePostMeta";
const ARCHIVE_META_CACHE_TTL_MS = 5 * 60 * 1000;

export type ArchivePostMeta = {
    id: number;
    idString: string;
    fileName: string;
    title: string;
    date: string;
    tags: string[];
    categories: string[];
    year: number;
    month: number;
    day: number;
};

export type ArchivePostFull = {
    id: string;
    title: string;
    date: string;
    tags: string[];
    category: string[];
    content: string;
    update: string;
    size: number;
};

function normalizeCategories(data: any): string[] {
    if (Array.isArray(data.category)) return data.category.filter(Boolean);
    if (Array.isArray(data.categories)) return data.categories.filter(Boolean);
    if (typeof data.category === "string" && data.category) return [data.category];
    if (typeof data.categories === "string" && data.categories) return [data.categories];
    return [];
}

function normalizeTags(data: any): string[] {
    if (Array.isArray(data.tags)) return data.tags.filter(Boolean);
    if (typeof data.tags === "string" && data.tags) return [data.tags];
    return [];
}

function parseDateParts(dateValue: any) {
    const raw = String(dateValue ?? "");
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return {
        dateString: raw,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
    };
}

export async function getAllArchivePostMeta(): Promise<ArchivePostMeta[]> {
    const cached = getCache<ArchivePostMeta[]>(ARCHIVE_META_CACHE_KEY);
    if (cached) return cached;

    const files = await getAllPostFiles();
    const metas = await Promise.all(
        files.map(async (fileName) => {
            const filePath = path.join(postsDirectory, fileName);
            const fileContents = await fs.readFile(filePath, "utf8");
            const { data } = matter(fileContents);
            const { postId } = id2slug(fileName);
            const id = Number(postId);
            const dateParts = parseDateParts(data.date);

            if (!Number.isFinite(id) || !dateParts) return null;

            return {
                id,
                idString: String(postId).padStart(5, "0"),
                fileName,
                title: data.title || "Untitled",
                date: dateParts.dateString,
                tags: normalizeTags(data),
                categories: normalizeCategories(data),
                year: dateParts.year,
                month: dateParts.month,
                day: dateParts.day,
            } as ArchivePostMeta;
        })
    );

    const filtered = metas.filter(Boolean) as ArchivePostMeta[];
    setCache(ARCHIVE_META_CACHE_KEY, filtered, ARCHIVE_META_CACHE_TTL_MS);
    return filtered;
}

export async function getPostsByTag(tag: string): Promise<ArchivePostMeta[]> {
    const all = await getAllArchivePostMeta();
    return all.filter((post) => post.tags.includes(tag)).sort((a, b) => b.id - a.id);
}

export async function getPostsByYear(year: number): Promise<ArchivePostMeta[]> {
    const all = await getAllArchivePostMeta();
    return all.filter((post) => post.year === year).sort((a, b) => a.id - b.id);
}

export async function getPostsByYearMonth(year: number, month: number): Promise<ArchivePostMeta[]> {
    const all = await getAllArchivePostMeta();
    return all
        .filter((post) => post.year === year && post.month === month)
        .sort((a, b) => a.id - b.id);
}

export async function resolveTagByUrlKey(urlKey: string): Promise<{ tag: string | null; collision: boolean }> {
    const all = await getAllArchivePostMeta();
    const matched = new Set<string>();

    for (const post of all) {
        for (const tag of post.tags) {
            if (tagToUrlKey(tag) === urlKey) {
                matched.add(tag);
            }
        }
    }

    if (matched.size > 1) return { tag: null, collision: true };
    if (matched.size === 0) return { tag: null, collision: false };

    return { tag: Array.from(matched)[0], collision: false };
}

export async function getArchivePostFullList(posts: ArchivePostMeta[]): Promise<ArchivePostFull[]> {
    return Promise.all(
        posts.map(async (post) => {
            const filePath = path.join(postsDirectory, post.fileName);
            const fileContents = await fs.readFile(filePath, "utf8");
            const { data, content } = matter(fileContents);
            const stats = await fs.stat(filePath);

            return {
                id: post.idString,
                title: data.title || post.title || "Untitled",
                date: String(data.date || post.date || ""),
                tags: normalizeTags(data),
                category: normalizeCategories(data),
                content,
                update: formatDate(stats.mtime),
                size: content.length,
            };
        })
    );
}
