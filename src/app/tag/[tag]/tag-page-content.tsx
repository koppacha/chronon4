import { notFound } from "next/navigation";
import Container from "@/components/container";
import Header from "@/components/header";
import PaginationNav from "@/components/pagination-nav";
import ArchiveArticleList from "@/components/archive-article-list";
import PostBody from "@/components/post-body";
import {
    getArchivePostFullList,
    getKeywordDocNames,
    getKeywordDocByNames,
    getPostsByTag,
    getVisibleArchivePostMeta,
    resolveTagByUrlKey,
} from "@/lib/archive";
import { LIST_PAGE_SIZE, paginateItems } from "@/lib/pagination";
import { tagToUrlKey } from "@/lib/tag-url";

export function normalizeTagUrlKey(value: string) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function parseTagPageParam(value: string) {
    if (!/^[1-9]\d*$/.test(value)) return null;
    return Number(value);
}

function tagPageHref(canonicalUrlTagKey: string, page: number) {
    const encodedTag = encodeURIComponent(canonicalUrlTagKey);
    return page === 1 ? `/tag/${encodedTag}` : `/tag/${encodedTag}/${page}`;
}

export async function generateTagStaticParams() {
    const posts = await getVisibleArchivePostMeta();
    const keywordDocNames = await getKeywordDocNames();
    const tags = Array.from(
        new Set(
            [
                ...posts.flatMap((post) => post.tags.map((tag) => tagToUrlKey(tag))),
                ...keywordDocNames,
            ]
        )
    );

    return tags.map((tag) => ({ tag }));
}

export async function generateTagPageStaticParams() {
    const posts = await getVisibleArchivePostMeta();
    const keywordDocNames = await getKeywordDocNames();
    const counts = new Map<string, number>();

    for (const post of posts) {
        for (const tag of post.tags) {
            const urlKey = tagToUrlKey(tag);
            counts.set(urlKey, (counts.get(urlKey) ?? 0) + 1);
        }
    }

    for (const keywordDocName of keywordDocNames) {
        if (!counts.has(keywordDocName)) {
            counts.set(keywordDocName, 0);
        }
    }

    return Array.from(counts.entries()).flatMap(([tag, count]) => {
        const totalPages = Math.ceil(count / LIST_PAGE_SIZE);
        return Array.from({ length: Math.max(1, totalPages) }, (_, index) => ({
            tag,
            page: String(index + 1),
        }));
    });
}

export async function renderTagPage(rawTagParam: string, page: number) {
    const urlTagKey = normalizeTagUrlKey(rawTagParam);
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
                <h1 className="archive-title">{displayTag}</h1>
                {keywordDoc ? (
                    <article className="article" style={{ marginBottom: "2rem" }}>
                        <PostBody category="" content={keywordDoc.content} date="" />
                    </article>
                ) : null}
                {pagination ? (
                    <>
                        <PaginationNav
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                            getPageHref={(nextPage) => tagPageHref(canonicalUrlTagKey, nextPage)}
                        />
                        <ArchiveArticleList posts={fullPosts} />
                        <PaginationNav
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                            getPageHref={(nextPage) => tagPageHref(canonicalUrlTagKey, nextPage)}
                        />
                    </>
                ) : null}
            </div>
        </Container>
    );
}
