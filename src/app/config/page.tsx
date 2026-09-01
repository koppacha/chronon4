import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Container from "@/components/container";
import Header from "@/components/header";
import SettingsForm from "@/components/settings-form";
import prisma from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth-session";
import { getVisibleArchivePostMeta } from "@/lib/archive";
import { decidePostAccess, getLatestPublishedPostIdsFromSource } from "@/lib/post-visibility";
import ArticleList, { type ArticleListItem } from "@/components/article-list";
import { ReadStatusProvider } from "@/components/read-status";
import { getActiveReadSummary, userReadActor } from "@/lib/read-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ユーザー設定", robots: { index: false, follow: false, nocache: true } };

export default async function ConfigPage() {
    const session = await getCurrentSession();
    if (!session) redirect("/login");

    const [user, likes, readSummary, intro, visiblePosts, likeCount] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
        prisma.userLike.findMany({ where: { userId: session.user.id, active: true }, orderBy: { updatedAt: "desc" }, take: 50 }),
        getActiveReadSummary(userReadActor(session.user.id), 50),
        prisma.siteSetting.findUnique({ where: { key: "intro_notice" } }),
        getVisibleArchivePostMeta(),
        prisma.userLike.count({ where: { userId: session.user.id, active: true } }),
    ]);
    const metaById = new Map(visiblePosts.map((post) => [post.idString, post]));
    const latestIds = await getLatestPublishedPostIdsFromSource();
    const readablePostCount = visiblePosts.filter((post) => decidePostAccess(post, session.user.role, latestIds).canViewBody).length;
    const toArticleListItem = (articleId: string): ArticleListItem | null => {
        const post = metaById.get(articleId);
        return post ? {
            id: post.idString,
            title: post.title,
            date: post.date,
            tags: post.tags,
            categories: post.categories,
        } : null;
    };
    const likePosts = likes.map((like) => toArticleListItem(like.articleId)).filter((post): post is ArticleListItem => post !== null);
    const readPosts = readSummary.recent.map((read) => toArticleListItem(read.articleId)).filter((post): post is ArticleListItem => post !== null);
    const statusArticleIds = Array.from(new Set([...likePosts, ...readPosts].map((post) => String(post.id).padStart(5, "0"))));

    return (
        <Container maxWidth="xl">
            <Header />
            <main className="config-page">
                <h1>ユーザー設定</h1>
                <SettingsForm initialHandleName={user.handleName ?? ""} isAdmin={session.user.role >= 10} initialNotice={intro?.value ?? ""} />
                <ReadStatusProvider articleIds={statusArticleIds}>
                    <section className="config-list">
                        <h2>最近いいねした記事（{likeCount}件）</h2>
                        <ArticleList posts={likePosts} />
                    </section>
                    <section className="config-list">
                        <h2>最近既読にした記事（{readSummary.count} / {readablePostCount}件）</h2>
                        <ArticleList posts={readPosts} />
                    </section>
                </ReadStatusProvider>
            </main>
        </Container>
    );
}
