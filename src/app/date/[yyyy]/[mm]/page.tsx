import { notFound } from "next/navigation";
import Container from "@/components/container";
import Header from "@/components/header";
import SideMenu from "@/components/side-menu";
import DateArchiveHeader from "@/components/date-archive-header";
import PaginationNav from "@/components/pagination-nav";
import ArchiveArticleList from "@/components/archive-article-list";
import { getArchivePostFullList, getPostsByYearMonth } from "@/lib/archive";
import { LIST_PAGE_SIZE, paginateItems, parsePageParam } from "@/lib/pagination";

function parseYear(value: string) {
    if (!/^\d{4}$/.test(value)) return null;
    const year = Number(value);
    const currentYear = new Date().getFullYear();
    if (year < 2004 || year > currentYear) return null;
    return year;
}

function parseMonth(value: string) {
    if (!/^(0[1-9]|1[0-2])$/.test(value)) return null;
    return Number(value);
}

export default async function DateMonthPage({
    params,
    searchParams,
}: {
    params: Promise<{ yyyy: string; mm: string }>;
    searchParams: Promise<{ page?: string | string[] }>;
}) {
    const { yyyy, mm } = await params;
    const query = await searchParams;

    const year = parseYear(yyyy);
    const month = parseMonth(mm);
    const page = parsePageParam(query.page);
    if (!year || !month || page === null) notFound();

    const posts = await getPostsByYearMonth(year, month);
    if (posts.length === 0) notFound();

    const pagination = paginateItems(posts, page, LIST_PAGE_SIZE);
    if (!pagination) notFound();

    const fullPosts = await getArchivePostFullList(pagination.items);

    return (
        <Container maxWidth="xl">
            <Header />
            <DateArchiveHeader title={`${year}/${mm}`} activeYear={year} activeMonth={month} />
            <PaginationNav
                basePath={`/date/${year}/${mm}`}
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
            />
            <ArchiveArticleList posts={fullPosts} />
            <PaginationNav
                basePath={`/date/${year}/${mm}`}
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
            />
            <DateArchiveHeader title={`${year}/${mm}`} activeYear={year} activeMonth={month} showTitle={false} />
        </Container>
    );
}
