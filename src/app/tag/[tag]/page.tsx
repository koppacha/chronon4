import { notFound } from "next/navigation";
import Container from "@/components/container";
import Header from "@/components/header";
import PaginationNav from "@/components/pagination-nav";
import ArchiveArticleList from "@/components/archive-article-list";
import PostBody from "@/components/post-body";
import {
    getArchivePostFullList,
    getKeywordDocByNames,
    getPostsByTag,
    resolveTagByUrlKey,
} from "@/lib/archive";
import { LIST_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";
import { tagToUrlKey } from "@/lib/tag-url";

function normalizeTagUrlKey(value: string) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export default async function TagPage({
    params,
    searchParams,
}: {
    params: Promise<{ tag: string }>;
    searchParams: Promise<{ page?: string | string[] }>;
}) {
    const { tag: rawTagParam } = await params;
    const urlTagKey = normalizeTagUrlKey(rawTagParam);
    const query = await searchParams;

    const page = parsePageParam(query.page);
    if (page === null) notFound();

    const resolved = await resolveTagByUrlKey(urlTagKey);
    if (resolved.collision) notFound();

    const posts = resolved.tag ? await getPostsByTag(resolved.tag) : [];
    const keywordDoc = await getKeywordDocByNames(resolved.tag ? [resolved.tag, urlTagKey] : [urlTagKey]);

    if (posts.length === 0 && !keywordDoc) notFound();
    if (posts.length === 0 && page !== 1) notFound();

    const pagination = posts.length > 0 ? paginateItems(posts, page, LIST_PAGE_SIZE) : null;
    if (posts.length > 0 && !pagination) notFound();

    const fullPosts = pagination ? await getArchivePostFullList(pagination.items) : [];
    const displayTag = resolved.tag || keywordDoc?.name || urlTagKey;
    const canonicalUrlTagKey = resolved.tag ? tagToUrlKey(resolved.tag) : urlTagKey;

    return (
        <Container maxWidth="xl">
            <Header />
            <div style={{ width: "100%" }}>
                <h1 className="archive-title">タグ: {displayTag}</h1>
                {keywordDoc ? (
                    <article className="article" style={{ marginBottom: "2rem" }}>
                        <PostBody category="" content={keywordDoc.content} date="2004-09-01" />
                    </article>
                ) : null}
                {pagination ? (
                    <>
                        <PaginationNav
                            basePath={`/tag/${encodeURIComponent(canonicalUrlTagKey)}`}
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                        />
                        <ArchiveArticleList posts={fullPosts} />
                        <PaginationNav
                            basePath={`/tag/${encodeURIComponent(canonicalUrlTagKey)}`}
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                        />
                    </>
                ) : null}
            </div>
        </Container>
    );
}
