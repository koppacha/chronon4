import { join } from "path";
import fs from "fs/promises";
import matter from "gray-matter";
import { getAllPostFiles } from "@/lib/posts";
import { formatDate, id2slug } from "@/lib/chronon4";

export type PostDetail = {
    id: string;
    title: string | null;
    date: string | null;
    category: string[] | string | null;
    tags: string[];
    content: string;
    update: string;
    size: number;
};

export async function getPostDetailById(id: string): Promise<PostDetail | null> {
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

    return {
        id: postId || "0",
        title: data.title || null,
        date: data.date || null,
        category: data.category || data.categories || null,
        tags: data.tags || [],
        content,
        update: formatDate(stats.mtime),
        size: content.length,
    };
}
