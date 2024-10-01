import Container from "@/app/_components/container";
import { HeroPost } from "@/app/_components/hero-post";
import { Intro } from "@/app/_components/intro";
import { MoreStories } from "@/app/_components/more-stories";
import {getAllPosts, getRecentPostsById} from "@/lib/api";
import {PostHeader} from "@/app/_components/post-header";
import PostBody from "@/app/_components/post-body";
import markdownToHtml from "@/lib/markdownToHtml";

export default function Index() {

    function RenderRecentPosts() {
        // 最新の7つの投稿を取得
        const posts = getRecentPostsById();
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
      <Container>
        <Intro />
        <RenderRecentPosts />
      </Container>
    </main>
    );
}
