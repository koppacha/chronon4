import { notFound } from "next/navigation";
import Container from "@/components/container";
import Header from "@/components/header";
import SideMenu from "@/components/side-menu";
import PaginationNav from "@/components/pagination-nav";
import ArchiveArticleList from "@/components/archive-article-list";
import { getArchivePostFullList, getPostsByTag, resolveTagByUrlKey } from "@/lib/archive";
import { LIST_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

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
    if (resolved.collision || !resolved.tag) notFound();

    const posts = await getPostsByTag(resolved.tag);
    if (posts.length === 0) notFound();

    const pagination = paginateItems(posts, page, LIST_PAGE_SIZE);
    if (!pagination) notFound();

    const fullPosts = await getArchivePostFullList(pagination.items);

    return (
        <Container maxWidth="xl">
            <Header />
            <div style={{ width: "100%" }}>
                <h1 className="archive-title">タグ: {resolved.tag}</h1>
                <PaginationNav
                    basePath={`/tag/${encodeURIComponent(urlTagKey)}`}
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                />
                <ArchiveArticleList posts={fullPosts} />
                <PaginationNav
                    basePath={`/tag/${encodeURIComponent(urlTagKey)}`}
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                />
            </div>
        </Container>
    );
}
