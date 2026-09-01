import { isPostPubliclyVisible } from "@/lib/publication-delay";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { id2slug } from "@/lib/chronon4";
import { getAllPostFilesFresh, postsDirectory } from "@/lib/posts";

export const SEMI_PRIVATE_TAG = "準非公開の記事";
export const SPECIAL_PUBLIC_TAG = "特別公開中の記事";
export const ADMIN_ROLE = 10;
export const USER_ROLE = 1;
export const GUEST_ROLE = 0;
export const GUEST_LATEST_POST_COUNT = 10;

export type PostAccessInput = {
    id: string | number;
    tags: unknown;
    date: string | Date | null | undefined;
};

export type PostAccessDecision = {
    published: boolean;
    canViewBody: boolean;
    reason: "not_published" | "invalid_id" | "semi_private" | "special_public" | "legacy_admin_only" | "latest_public" | "authenticated" | "login_required";
};

export function getLatestPublishedPostIds(posts: Array<{ id: number }>): Set<number> {
    return new Set(
        posts
            .filter((post) => Number.isSafeInteger(post.id) && post.id > 0)
            .sort((a, b) => b.id - a.id)
            .slice(0, GUEST_LATEST_POST_COUNT)
            .map((post) => post.id),
    );
}

export async function selectLatestPublishedPostIds(
    candidates: Array<{ id: number; fileName: string }>,
    readDate: (fileName: string) => Promise<string | Date | null | undefined>,
    now = new Date(),
): Promise<Set<number>> {
    const ids = new Set<number>();
    for (const candidate of candidates
        .filter((post) => Number.isSafeInteger(post.id) && post.id > 0)
        .sort((a, b) => b.id - a.id)) {
        if (!isPostPubliclyVisible(await readDate(candidate.fileName), now)) continue;
        ids.add(candidate.id);
        if (ids.size === GUEST_LATEST_POST_COUNT) break;
    }
    return ids;
}

/**
 * 本文認可に使用する最新記事集合。公開一覧用キャッシュから分離し、
 * 記事追加・公開日の変更直後でも現在のファイル状態から算出する。
 */
export async function getLatestPublishedPostIdsFromSource(now = new Date()): Promise<Set<number>> {
    const candidates = (await getAllPostFilesFresh())
        .map((fileName) => ({ fileName, id: Number(id2slug(fileName).postId) }))
    return selectLatestPublishedPostIds(candidates, async (fileName) => {
        const source = await fs.readFile(path.join(postsDirectory, fileName), "utf8");
        const { data } = matter(source);
        return data.date;
    }, now);
}
export function decidePostAccess(
    post: PostAccessInput,
    viewerRole: number,
    latestPublishedPostIds: ReadonlySet<number>,
    now = new Date(),
): PostAccessDecision {
    if (!isPostPubliclyVisible(post.date, now)) {
        return { published: false, canViewBody: false, reason: "not_published" };
    }

    const id = typeof post.id === "number" ? post.id : Number(post.id);
    const isAdmin = viewerRole >= ADMIN_ROLE;
    const isAuthenticated = viewerRole >= USER_ROLE;
    if (!Number.isSafeInteger(id) || id <= 0) {
        return { published: true, canViewBody: isAdmin, reason: "invalid_id" };
    }

    const tags = Array.isArray(post.tags) ? post.tags.filter((tag): tag is string => typeof tag === "string") : [];
    if (tags.includes(SEMI_PRIVATE_TAG)) {
        return { published: true, canViewBody: isAdmin, reason: "semi_private" };
    }
    if (tags.includes(SPECIAL_PUBLIC_TAG)) {
        return { published: true, canViewBody: true, reason: "special_public" };
    }
    if (id < 6955) {
        return { published: true, canViewBody: isAdmin, reason: "legacy_admin_only" };
    }
    if (latestPublishedPostIds.has(id)) {
        return { published: true, canViewBody: true, reason: "latest_public" };
    }
    if (isAuthenticated) {
        return { published: true, canViewBody: true, reason: "authenticated" };
    }
    return { published: true, canViewBody: false, reason: "login_required" };
}

export function filterPostsForUnanchoredRecentList<T extends PostAccessInput>(
    posts: T[],
    viewerRole: number,
    latestPublishedPostIds: ReadonlySet<number>,
): T[] {
    if (viewerRole !== GUEST_ROLE) return posts;
    return posts.filter((post) => decidePostAccess(post, viewerRole, latestPublishedPostIds).canViewBody);
}
