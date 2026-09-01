"use client";

import Link from "next/link";
import { ReadStatusIcon, ReadStatusProvider } from "@/components/read-status";

export type ArticleListItem = {
    id: string | number;
    title: string;
    date: string;
    tags?: string[];
    categories?: string[];
    read?: boolean;
};

type Props = {
    posts: ArticleListItem[];
    currentId?: string | null;
    variant?: "default" | "compact";
    tagDisplay?: "all" | "first";
    provideReadStatus?: boolean;
};

function normalizeId(id: string | number) {
    return String(id).padStart(5, "0");
}

function formatDate(date: string) {
    const match = date.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) return `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`;

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function ArticleListContent({ posts, currentId, variant = "default", tagDisplay = "all" }: Omit<Props, "provideReadStatus">) {
    const normalizedCurrentId = currentId ? normalizeId(currentId) : null;
    const compact = variant === "compact";

    const items = posts.map((post) => {
        const id = normalizeId(post.id);
        const tags = tagDisplay === "first" ? (post.tags ?? []).slice(0, 1) : (post.tags ?? []);
        const className = `${compact ? "post-list" : "post-block"}${id === normalizedCurrentId ? " post-block-current" : ""}`;
        const body = (
            <>
                <span>#{Number(id)}</span>『{post.title}』（
                <span>{formatDate(post.date)}<ReadStatusIcon articleId={id} initialRead={post.read} /></span>）
                <br />
                {tags.map((tag, index) => (
                    <span key={`${id}-${tag}-${index}`} className="tag-block">{tag}</span>
                ))}
                {(post.categories ?? []).length > 0 && (
                    <span className="tag-block">{post.categories?.join(", ")}</span>
                )}
            </>
        );

        if (compact) {
            return (
                <li key={id} className={className}>
                    <Link href={`/post/${id}`} prefetch={false}>{body}</Link>
                </li>
            );
        }

        return (
            <Link key={id} href={`/post/${id}`} prefetch={false}>
                <div className={className}>{body}</div>
            </Link>
        );
    });

    return compact
        ? <ul className="article-list article-list-compact">{items}</ul>
        : <div className="article-list">{items}</div>;
}

export default function ArticleList({ provideReadStatus = false, ...props }: Props) {
    const content = <ArticleListContent {...props} />;
    if (!provideReadStatus) return content;

    return (
        <ReadStatusProvider articleIds={props.posts.map((post) => normalizeId(post.id))}>
            {content}
        </ReadStatusProvider>
    );
}
