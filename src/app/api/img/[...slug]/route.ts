import { NextRequest, NextResponse } from "next/server";
import { resolve, sep, extname } from "node:path";
import { promises as fs } from "node:fs";
import matter from "gray-matter";
import { getCurrentSession } from "@/lib/auth-session";
import { getPostsByYearMonth, type ArchivePostMeta } from "@/lib/archive";
import { getPostContent } from "@/lib/posts";
import { decidePostAccess, getLatestPublishedPostIdsFromSource } from "@/lib/post-visibility";
import { getCache, setCache } from "@/lib/cache";

type RouteContext = { params: Promise<{ slug: string[] }> };
const OWNER_CACHE_TTL_MS = 5 * 60 * 1000;

async function findOwners(year: number, month: number, fileName: string): Promise<ArchivePostMeta[]> {
    const cacheKey = `imageOwners:${year}:${month}:${fileName}`;
    const cached = getCache<ArchivePostMeta[]>(cacheKey);
    if (cached) return cached;
    const posts = await getPostsByYearMonth(year, month);
    const marker = `![[${fileName}|`;
    const owners = (await Promise.all(posts.map(async (post) => {
        const content = await getPostContent(post.fileName);
        return content.includes(marker) ? post : null;
    }))).filter((post): post is ArchivePostMeta => post !== null);
    setCache(cacheKey, owners, OWNER_CACHE_TTL_MS);
    return owners;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
    const slugParts = (await params).slug;
    if (!Array.isArray(slugParts) || slugParts.length !== 4 || slugParts[2] !== "images") {
        return new NextResponse(null, { status: 404 });
    }
    const [yearText, monthText, , fileName] = slugParts;
    if (!/^\d{4}$/.test(yearText) || !/^(0[1-9]|1[0-2])$/.test(monthText) || !fileName || fileName.includes("/") || fileName.includes("\\")) {
        return new NextResponse(null, { status: 400 });
    }

    const mimeMap: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif",
    };
    const contentType = mimeMap[extname(fileName).toLowerCase().slice(1)];
    if (!contentType) return new NextResponse(null, { status: 404 });

    try {
        const owners = await findOwners(Number(yearText), Number(monthText), fileName);
        if (owners.length === 0) return new NextResponse(null, { status: 404 });
        const latestIds = await getLatestPublishedPostIdsFromSource();
        const session = await getCurrentSession();
        const role = session?.user.role ?? 0;
        const currentOwners = (await Promise.all(owners.map(async (post) => {
            const source = await getPostContent(post.fileName);
            if (!source.includes(`![[${fileName}|`)) return null;
            const { data } = matter(source);
            return { id: post.id, date: data.date as string | Date | null | undefined, tags: data.tags ?? [] };
        }))).filter((post): post is { id: number; date: string | Date | null | undefined; tags: unknown } => post !== null);
        if (currentOwners.length === 0) return new NextResponse(null, { status: 404 });
        const guestAllowed = currentOwners.some((post) => decidePostAccess(post, 0, latestIds).canViewBody);
        const viewerAllowed = currentOwners.some((post) => decidePostAccess(post, role, latestIds).canViewBody);
        if (!viewerAllowed) return new NextResponse(null, { status: 403 });

        const blogRoot = resolve(process.cwd(), "blog");
        const localPath = resolve(blogRoot, yearText, monthText, "images", fileName);
        if (!localPath.startsWith(blogRoot + sep)) return new NextResponse(null, { status: 400 });
        const data = await fs.readFile(localPath);
        return new NextResponse(data, {
            headers: {
                "Content-Type": contentType,
                // URLが不変のため、公開条件変更後に古い画像を配信しないよう毎回再検証する。
                "Cache-Control": guestAllowed ? "public, max-age=0, must-revalidate" : "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return new NextResponse(null, { status: 404 });
    }
}
