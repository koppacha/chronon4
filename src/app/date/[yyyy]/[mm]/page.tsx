import { notFound } from "next/navigation";
import Container from "@/components/container";
import Header from "@/components/header";
import DateArchiveHeader from "@/components/date-archive-header";
import ArchiveArticleList from "@/components/archive-article-list";
import { getArchivePostFullList, getPostsByYearMonth, getVisibleArchivePostMeta } from "@/lib/archive";

export const revalidate = 604800;
export const dynamicParams = true;

export async function generateStaticParams() {
    const posts = await getVisibleArchivePostMeta();
    const yearMonths = Array.from(
        new Set(
            posts.map((post) => `${post.year}/${String(post.month).padStart(2, "0")}`)
        )
    );

    return yearMonths.map((yearMonth) => {
        const [yyyy, mm] = yearMonth.split("/");
        return { yyyy, mm };
    });
}

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
}: {
    params: Promise<{ yyyy: string; mm: string }>;
}) {
    const { yyyy, mm } = await params;

    const year = parseYear(yyyy);
    const month = parseMonth(mm);
    if (!year || !month) notFound();

    const posts = await getPostsByYearMonth(year, month);
    if (posts.length === 0) notFound();

    const fullPosts = await getArchivePostFullList(posts);

    return (
        <Container maxWidth="xl">
            <Header />
            <DateArchiveHeader title={`${year}/${mm}`} activeYear={year} activeMonth={month} />
            <ArchiveArticleList posts={fullPosts} />
            <DateArchiveHeader title={`${year}/${mm}`} activeYear={year} activeMonth={month} showTitle={false} />
        </Container>
    );
}
