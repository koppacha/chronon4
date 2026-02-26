import { PostHeader } from "@/components/post-header";
import PostBodyGuard from "@/components/post-body-guard";
import { PostFooter } from "@/components/post-footer";
import type { ArchivePostFull } from "@/lib/archive";

type Props = {
    posts: ArchivePostFull[];
};

export default function ArchiveArticleList({ posts }: Props) {
    return (
        <div style={{ width: "100%" }}>
            {posts.map((post) => (
                <article key={post.id} className="article">
                    <PostHeader
                        id={post.id}
                        title={post.title}
                        coverImage=""
                        date={post.date}
                        author={{ name: "", picture: "" }}
                        tags={post.tags}
                        categories={post.category}
                    />
                    <PostBodyGuard
                        idOrSlug={post.id}
                        tags={post.tags}
                        category={post.category}
                        content={post.content}
                        date={post.date}
                    />
                    <PostFooter id={post.id} update={post.update} size={post.size} />
                </article>
            ))}
        </div>
    );
}
