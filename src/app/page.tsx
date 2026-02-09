import Container from "@/components/container"
import { Intro } from "@/components/intro"
import { PostHeader } from "@/components/post-header"
import PostBody from "@/components/post-body"
import SideMenu from "@/components/side-menu"
import { baseUrl } from "@/lib/const"
import {PostFooter} from "@/components/post-footer";
type RecentPost = {
    id: string;
    title?: string;
    coverImage?: string;
    date?: string;
    author?: { name: string; picture: string } | string;
    tags?: string[];
    category?: string;
    content?: string;
    update?: string;
    size?: number;
};

async function getRecentPosts(): Promise<{ posts: RecentPost[]; error: string | null }> {
    try {
        const res = await fetch(`${baseUrl}/api/recent`, { cache: "no-store" });
        if (!res.ok) {
            return { posts: [], error: "記事の取得に失敗しました。しばらくしてから再試行してください。" };
        }
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            return { posts: [], error: "記事が見つかりませんでした。" };
        }
        return { posts: data, error: null };
    } catch (e) {
        console.error("Error Fetching Data:", e);
        return { posts: [], error: "記事の取得に失敗しました。しばらくしてから再試行してください。" };
    }
}

export default async function Index() {
    const { posts, error } = await getRecentPosts();

    return (
        <Container maxWidth="xl">
            <Intro />
            {error ? (
                <div className="error-message">{error}</div>
            ) : (
                <div style={{width:"100%"}}>
                    {posts.map((post) => (
                        <article key={post.id} className="article">
                            <PostHeader
                                id={post.id}
                                title={post.title ?? "Untitled"}
                                coverImage={post.coverImage ?? ""}
                                date={post.date ?? ""}
                                author={
                                    typeof post.author === "object" && post.author !== null
                                        ? post.author
                                        : { name: "", picture: "" }
                                }
                                tags={post.tags ?? []}
                                categories={post.category}
                            />
                            <PostBody
                                category={post.category}
                                content={post.content ?? ""}
                                date={post.date ?? ""}
                            />
                            <PostFooter
                                id={post.id}
                                update={post.update ?? ""}
                                size={post.size ?? 0}
                            />
                        </article>
                    ))}
                </div>
            )}
            <SideMenu slug={null} />
        </Container>
    )
}
