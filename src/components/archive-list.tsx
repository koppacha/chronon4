import Link from "next/link";
import type { ArchivePostMeta } from "@/lib/archive";

type Props = {
    posts: ArchivePostMeta[];
};

export default function ArchiveList({ posts }: Props) {
    return (
        <div style={{ width: "100%" }}>
            {posts.map((post) => (
                <Link key={post.id} href={`/post/${post.idString}`}>
                    <div className="post-block">
                        #{post.id}『{post.title}』（
                        {`${post.year}/${String(post.month).padStart(2, "0")}/${String(post.day).padStart(2, "0")}`}
                        ）
                        <br />
                        {post.tags.map((tag, index) => (
                            <span key={`${post.id}-${tag}-${index}`} className="tag-block">{tag}</span>
                        ))}
                        {post.categories.length > 0 && (
                            <span className="tag-block">{post.categories.join(", ")}</span>
                        )}
                    </div>
                </Link>
            ))}
        </div>
    );
}
