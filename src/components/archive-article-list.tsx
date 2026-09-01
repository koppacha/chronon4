import { PostHeader } from "@/components/post-header";
import PostBodyGuard from "@/components/post-body-guard";
import { PostFooter } from "@/components/post-footer";
import type { ArchivePostFull } from "@/lib/archive";
import { ReadStatusProvider } from "@/components/read-status";
import { getYearColorHex } from "@/lib/year-color";
import { LikeStatusProvider } from "@/components/like-status";

type Props = {
    posts: ArchivePostFull[];
};

export default function ArchiveArticleList({ posts }: Props) {
    return (
        <ReadStatusProvider articleIds={posts.map((post) => post.id)}>
        <LikeStatusProvider articleIds={posts.filter((post) => post.canViewBody).map((post) => post.id)}>
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
                        canViewBody={post.canViewBody}
                        category={post.category}
                        content={post.content}
                        date={post.date}
                        fileName={post.fileName}
                        sourceMtimeMs={post.sourceMtimeMs}
                    />
                    <PostFooter
                        id={post.id}
                        update={post.update}
                        size={post.size}
                        canInteract={post.canViewBody}
                        yearColor={getYearColorHex(post.date) ?? undefined}
                    />
                </article>
            ))}
        </div>
        </LikeStatusProvider>
        </ReadStatusProvider>
    );
}
