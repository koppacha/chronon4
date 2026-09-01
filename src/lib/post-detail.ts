import { join } from "path";
import fs from "fs/promises";
import matter from "gray-matter";
import { getAllPostFiles } from "@/lib/posts";
import { formatDate, id2slug } from "@/lib/chronon4";
import { isPostPubliclyVisible } from "@/lib/publication-delay";
import { decidePostAccess, getLatestPublishedPostIdsFromSource } from "@/lib/post-visibility";

export type PostDetail = {
    id: string;
    fileName: string;
    title: string | null;
    date: string | null;
    category: string[] | string | null;
    tags: string[];
    content: string | null;
    canViewBody: boolean;
    update: string;
    size: number;
    sourceMtimeMs: number;
};

export async function getPostDetailById(
    id: string,
    viewerRole = 0,
    latestPublishedPostIds?: ReadonlySet<number>,
): Promise<PostDetail | null> {
    if (!/^\d{1,5}$/.test(id)) {
        return null;
    }

    const searchTrigger = id.padStart(5, "0");
    const allPosts = await getAllPostFiles();
    const targetFile = allPosts.find((file) => file.endsWith(`${searchTrigger}.md`));

    if (!targetFile) {
        return null;
    }

    const fullPath = join("blog", targetFile);
    const fileContents = await fs.readFile(fullPath, "utf8");
    const { data, content } = matter(fileContents);
    const { postId } = id2slug(targetFile);
    const stats = await fs.stat(fullPath);

    if (!isPostPubliclyVisible(data.date)) {
        return null;
    }

    const currentLatestIds = latestPublishedPostIds ?? await getLatestPublishedPostIdsFromSource();
    const access = decidePostAccess({ id: postId || id, tags: data.tags || [], date: data.date }, viewerRole, currentLatestIds);

    return {
        id: postId || "0",
        fileName: targetFile,
        title: data.title || null,
        date: data.date || null,
        category: data.category || data.categories || null,
        tags: data.tags || [],
        content: access.canViewBody ? content : null,
        canViewBody: access.canViewBody,
        update: formatDate(stats.mtime),
        size: content.length,
        sourceMtimeMs: stats.mtimeMs,
    };
}
