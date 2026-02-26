import { notFound } from "next/navigation";
import Container from "@/components/container";
import Header from "@/components/header";
import SideMenu from "@/components/side-menu";
import ArchiveList from "@/components/archive-list";
import DateArchiveHeader from "@/components/date-archive-header";
import { getPostsByYear } from "@/lib/archive";

function parseYear(value: string) {
    if (!/^\d{4}$/.test(value)) return null;
    const year = Number(value);
    const currentYear = new Date().getFullYear();
    if (year < 2004 || year > currentYear) return null;
    return year;
}

export default async function DateYearPage({ params }: { params: Promise<{ yyyy: string }> }) {
    const { yyyy } = await params;
    const year = parseYear(yyyy);
    if (!year) notFound();

    const posts = await getPostsByYear(year);
    if (posts.length === 0) notFound();

    return (
        <Container maxWidth="xl">
            <Header />
            <DateArchiveHeader title={`${year}年`} activeYear={year} />
            <ArchiveList posts={posts} />
            <DateArchiveHeader title={`${year}年`} activeYear={year} showTitle={false} />
        </Container>
    );
}
