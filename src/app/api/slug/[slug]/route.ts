import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-session";
import { getPostDetailById } from "@/lib/post-detail";

const SLUG_PATTERN = /^\d{4}-\d{2}-\d{2}-(\d{5})$/;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const realSlug = slug.replace(/\.md$/, "");
        const match = realSlug.match(SLUG_PATTERN);
        if (!match) return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });

        const session = await getCurrentSession();
        const post = await getPostDetailById(match[1], session?.user.role ?? 0);
        if (!post || !post.fileName.endsWith(`${realSlug}.md`)) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }
        return NextResponse.json({
            title: post.title,
            date: post.date,
            category: post.category,
            tags: post.tags,
            slug: realSlug,
            content: post.content,
            canViewBody: post.canViewBody,
        }, {
            headers: { "Cache-Control": session ? "private, no-store" : "public, max-age=0, must-revalidate" },
        });
    } catch (error) {
        console.error("Slug API failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
