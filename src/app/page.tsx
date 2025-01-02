import Container from "@/components/container";
import { HeroPost } from "@/components/hero-post";
import { Intro } from "@/components/intro";
import { MoreStories } from "@/components/more-stories";
import {getAllPosts, getRecentPostsById} from "@/lib/api";
import {PostHeader} from "@/components/post-header";
import PostBody from "@/components/post-body";
import markdownToHtml from "@/lib/markdownToHtml";
import RelatedList from "@/components/related-list";
import SideMenu from "@/components/side-menu";
import {Box} from "@mui/material";
import {Grid} from "@mui/system";
import {headers} from "next/headers";

export default function Index() {

    async function RenderRecentPosts() {
        // TODO: BaseUrlを指定しないと取得できない
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/recent`);
        const posts = await res.json();

        return (
            <div>
                {posts.map(async (post) => (
                    <article key={post.id} className="article">
                        <PostHeader
                            id={post.slug}
                            title={post.title}
                            coverImage={post.coverImage}
                            date={post.date}
                            author={post.author}
                            tags={post.tags}
                            categories={post.categories}
                        />
                        <PostBody content={await markdownToHtml(post.content || "")} date={post.date}/>
                    </article>
                ))}
            </div>
        );
    }

    return (
        <main>
            <Box sx={{ display: "flex" }}>
                {/* サイドメニュー */}
                <SideMenu />
                {/* コンテンツエリア */}
                <Container>
                    <Intro/>
                    <RenderRecentPosts/>
                </Container>
            </Box>
        </main>
    );
}
