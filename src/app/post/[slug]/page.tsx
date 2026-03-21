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

export const revalidate = 2000;

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {

    try {
        const {slug} = await params;
        const post = await getPostDetailById(slug);
        if (!post) {
            notFound();
        }


        // 前後記事のURLを生成
        const zeroPad = (num: number) => String(num).padStart(5, "0");
        const prev = Number(slug) > 1 && (
            <div className="grid-item">
                <Link href={`/post/${zeroPad(Number(slug) - 1)}`}>前の記事へ</Link>
            </div>
        );
        const next = new Date(post.date) < new Date() && (
            <div className="grid-item">
                <Link href={`/post/${zeroPad(Number(slug) + 1)}`}>次の記事へ</Link>
            </div>
        )
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
        )
    } catch (e) {
        console.error("Error Fetching Data:", e)
        notFound()
    }
}
