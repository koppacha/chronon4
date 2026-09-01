import Container from "@/components/container"
import { Intro } from "@/components/intro"
import { PostHeader } from "@/components/post-header"
import PostBodyGuard from "@/components/post-body-guard"
import SideMenu from "@/components/side-menu"
import {PostFooter} from "@/components/post-footer";
import DateArchiveHeader from "@/components/date-archive-header";
import TagStatsList from "@/components/tag-stats-list";
import { getRecentPostsData } from "@/lib/recent-posts";
import { getViewerRole } from "@/lib/auth-session";
import { ReadStatusProvider } from "@/components/read-status";
import { getYearColorHex } from "@/lib/year-color";
import { LikeStatusProvider } from "@/components/like-status";
import SiteStatisticsHeader from "@/components/site-statistics-header";

// 最新10本の境界変更後に古い本文を静的HTMLから配信しない。
// MarkdownからHTMLへの変換結果はrender-post-body側のキャッシュを再利用する。
export const dynamic = "force-dynamic";

type RecentPost = {
    id: string;
    fileName?: string;
    title?: string;
    coverImage?: string;
    date?: string;
    author?: { name: string; picture: string } | string;
    tags?: string[];
    category?: string;
    content?: string;
    update?: string;
    size?: number;
    sourceMtimeMs?: number;
    canViewBody?: boolean;
};

async function getRecentPosts(viewerRole = 0): Promise<{ posts: RecentPost[]; error: string | null }> {
    try {
        const data = await getRecentPostsData({ viewerRole });
        if (!Array.isArray(data) || data.length === 0) {
            return { posts: [], error: "記事が見つかりませんでした。" };
        }
        return { posts: data, error: null };
    } catch (e) {
        console.error("Error Fetching Data:", e);
        return { posts: [], error: "記事の取得に失敗しました。しばらくしてから再試行してください。" };
    }
}

export default async function Index() {
    const viewerRole = await getViewerRole();
    const { posts, error } = await getRecentPosts(viewerRole);

    const latestArchiveDate = posts.find((post) => post.date)?.date;
    const latestDateObj = latestArchiveDate ? new Date(latestArchiveDate) : null;
    const latestYear = latestDateObj && !Number.isNaN(latestDateObj.getTime()) ? latestDateObj.getFullYear() : null;
    const latestMonth = latestDateObj && !Number.isNaN(latestDateObj.getTime()) ? (latestDateObj.getMonth() + 1) : null;

    return (
        <Container maxWidth="xl">
            <Intro>
                <SiteStatisticsHeader />
            </Intro>
            {error ? (
                <div className="error-message">{error}</div>
            ) : (
                <ReadStatusProvider articleIds={posts.map((post) => post.id)}>
                <LikeStatusProvider articleIds={posts.filter((post) => post.canViewBody).map((post) => post.id)}>
                <div style={{width:"100%"}}>
                    {latestYear && latestMonth && (
                        <DateArchiveHeader
                            title=""
                            activeYear={latestYear}
                            activeMonth={latestMonth}
                            showTitle={false}
                        />
                    )}
                    {posts.map((post) => (
                        <article key={post.id} className="article">
                            <PostHeader
                                id={post.id}
                                title={post.title ?? "Untitled"}
                                coverImage={post.coverImage ?? ""}
                                date={post.date ?? ""}
                                author={
                                    typeof post.author === "object" && post.author !== null
                                        ? post.author
                                        : { name: "", picture: "" }
                                }
                                tags={post.tags ?? []}
                                categories={post.category}
                            />
                            <PostBodyGuard
                                canViewBody={Boolean(post.canViewBody)}
                                category={post.category ?? ""}
                                content={post.content ?? ""}
                                date={post.date ?? ""}
                                fileName={post.fileName}
                                sourceMtimeMs={post.sourceMtimeMs}
                            />
                            <PostFooter
                                id={post.id}
                                update={post.update ?? ""}
                                size={post.size ?? 0}
                                canInteract={Boolean(post.canViewBody)}
                                yearColor={getYearColorHex(post.date ?? "") ?? undefined}
                            />
                        </article>
                    ))}
                </div>
                </LikeStatusProvider>
                </ReadStatusProvider>
            )}
            <SideMenu slug={null} />
        </Container>
    )
}
