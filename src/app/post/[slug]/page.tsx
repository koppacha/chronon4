import Container from "@/components/container";
import Header from "@/components/header";
import PostBodyGuard from "@/components/post-body-guard";
import { PostHeader } from "@/components/post-header";
import Link from "next/link";
import ToggleLists from "@/components/toggle-list";
import SideMenu from "@/components/side-menu";
import {PostFooter} from "@/components/post-footer";
import { notFound } from "next/navigation";
import { getPostDetailById } from "@/lib/post-detail";
import { getVisibleArchivePostMeta } from "@/lib/archive";

export const revalidate = 604800;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
    const {slug} = await params;
    const post = await getPostDetailById(slug);
    if (!post) {
        notFound();
    }

    const visiblePosts = (await getVisibleArchivePostMeta()).sort((a, b) => a.id - b.id);
    const currentIndex = visiblePosts.findIndex((item) => item.idString === post.id);
    const prevPost = currentIndex > 0 ? visiblePosts[currentIndex - 1] : null;
    const nextPost = currentIndex >= 0 && currentIndex < visiblePosts.length - 1
        ? visiblePosts[currentIndex + 1]
        : null;

    const prev = prevPost && (
        <div className="grid-item">
            <Link href={`/post/${prevPost.idString}`}>前の記事へ</Link>
        </div>
    );
    const next = nextPost && (
        <div className="grid-item">
            <Link href={`/post/${nextPost.idString}`}>次の記事へ</Link>
        </div>
    );

    return (
        <Container maxWidth="xl">
            <Header/>
            <article className="article">
                <PostHeader
                    id={post.id}
                    title={post.title ?? "Untitled"}
                    coverImage=""
                    date={post.date}
                    author={{ name: "", picture: "" }}
                    tags={post.tags ?? []}
                    categories={post.category}
                />
                <PostBodyGuard
                    idOrSlug={slug}
                    tags={post.tags ?? []}
                    category={post.category}
                    content={post.content ?? ""}
                    date={post.date}
                    fileName={post.fileName}
                    sourceMtimeMs={post.sourceMtimeMs}
                />
                <PostFooter
                    id={post.id}
                    update={post.update ?? ""}
                    size={post.size ?? 0}
                />
            </article>
            <div className="grid-container">
                {prev}
                {next}
            </div>
            <br style={{clear: "both"}}/>
            <ToggleLists slug={slug} post={post}/>
            <SideMenu slug={slug}/>
        </Container>
    );
}
