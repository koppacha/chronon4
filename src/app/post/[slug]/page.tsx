import Container from "@/components/container";
import Header from "@/components/header";
import PostBodyGuard from "@/components/post-body-guard";
import { PostHeader } from "@/components/post-header";
import Link from "next/link";
import ToggleLists from "@/components/toggle-list";
import {baseUrl} from "@/lib/const";
import SideMenu from "@/components/side-menu";
import {PostFooter} from "@/components/post-footer";
import { notFound } from "next/navigation";

export const revalidate = 2000;

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {

    try {
        // 記事を取得
        const {slug} = await params;
        const res = await fetch(`${baseUrl}/api/single?n=${slug}`, {next: {revalidate}})

        if (!res.ok) {
            throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`)
        }
        const post = await res.json()


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
                        title={post.title}
                        coverImage={post.coverImage}
                        date={post.date}
                        author={post.author}
                        tags={post.tags}
                        categories={post.category}
                    />
                    <PostBodyGuard
                        idOrSlug={slug}
                        tags={post.tags}
                        category={post.category}
                        content={post.content}
                        date={post.date}
                    />
                    <PostFooter
                        id={post.id}
                        update={post.update}
                        size={post.size}
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
