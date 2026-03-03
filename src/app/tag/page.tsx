import Container from "@/components/container";
import Header from "@/components/header";
import SideMenu from "@/components/side-menu";
import TagStatsList from "@/components/tag-stats-list";

export default function TagIndexPage() {
    return (
        <Container maxWidth="xl">
            <Header />
            <TagStatsList n={0} title="すべてのタグ" />
            <SideMenu slug={null} />
        </Container>
    );
}
