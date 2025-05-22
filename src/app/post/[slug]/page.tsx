import markdownToHtml from "@/lib/markdownToHtml";
import Container from "@/components/container";
import Header from "@/components/header";
import PostBody from "@/components/post-body";
import { PostHeader } from "@/components/post-header";
import Link from "next/link";
import ToggleLists from "@/components/toggle-list";
import {baseUrl} from "@/lib/const";
import SideMenu from "@/components/side-menu";
import {PostFooter} from "@/components/post-footer";

export const revalidate = 2592000;

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {

    try {
        // 記事を取得
        const {slug} = await params;
        const res = await fetch(`${baseUrl}/api/single?n=${slug}`, {next: {revalidate}})

        if (!res.ok) {
            throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`)
        }
        const post = await res.json()

        // 記事が存在しない or 非公開タグがある場合は非公開フラグを設定
        const hiddenFlg = post.tags?.includes("準非公開の記事") || Number(slug) < 6955;

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
                    {
                        hiddenFlg ?
                            <div>この記事は非公開に設定されています。</div> :
                            <PostBody category={post.category[0]} content={post.content} date={post.date}/>
                    }
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
        return {
            notFound: true
        }
    }
}
