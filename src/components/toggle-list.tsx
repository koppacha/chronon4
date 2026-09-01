import { getVisibleArchivePostMeta } from "@/lib/archive";
import ArticleList from "@/components/article-list";
import { ReadStatusProvider } from "@/components/read-status";
import { selectCenteredWindow } from "@/lib/archive-navigation";

export default async function ToggleLists({slug, post}){
    const allPosts = await getVisibleArchivePostMeta();
    const byId = [...allPosts].sort((a, b) => a.id - b.id);
    const currentIndex = byId.findIndex((item) => item.idString === String(slug).padStart(5, "0"));
    const nearbyPosts = selectCenteredWindow(byId, currentIndex, 51, 25);
    const tagGroups = Array.isArray(post.tags)
        ? post.tags.map((tag: string) => ({
            tag,
            posts: allPosts
                .filter((item) => item.tags.includes(tag))
                .sort((a, b) => b.id - a.id)
                .slice(0, 10),
        }))
        : [];
    const articleIds = Array.from(new Set([
        ...nearbyPosts.map((item) => item.idString),
        ...tagGroups.flatMap((group) => group.posts.map((item) => item.idString)),
    ]));

    return (
        <ReadStatusProvider articleIds={articleIds}>
        <div style={{width:"100%"}}>
            {tagGroups.map(({ tag, posts }) => (
                <div className="post-list" key={tag}>
                    <div className="list-title">同じタグを含む記事（{tag}）</div>
                    <ArticleList posts={posts} currentId={String(slug).padStart(5, "0")} />
                </div>
            ))}
            <div className="post-list">
                <div className="list-title">前後の記事</div>
                <ArticleList posts={nearbyPosts} currentId={String(slug).padStart(5, "0")} />
            </div>
        </div>
        </ReadStatusProvider>
    );
}
