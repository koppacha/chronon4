"use client" // 🔹 クライアントコンポーネントにする

import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import ArticleList, { type ArticleListItem } from "@/components/article-list";

type Props = {
    slug: string | null;
};

const SideMenu: React.FC<Props> = ({ slug }) => {
    const [posts, setPosts] = useState<ArticleListItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let fetchUrl: string;
        if (!slug) {
            // トップ本文の最新10本より後の記事を表示する。ゲストは閲覧可能範囲を使い切るため0件になる。
            fetchUrl = `/api/recent?n=100&m=10&f=tdg`;
        } else {
            fetchUrl = `/api/recent?n=51&m=25&f=tdg&a=${slug}`;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);
        async function fetchPosts() {
            try {
                const res = await fetch(fetchUrl, {
                    cache: "no-store",
                    credentials: "same-origin",
                    signal: controller.signal,
                });

                if (!res.ok) {
                    throw new Error(`Failed to fetch data: ${res.status}`);
                }

                const data = await res.json();
                setPosts(data);
            } catch (e) {
                if (controller.signal.aborted) return;
                console.error("Error Fetching Data:", e);
                setError("記事リストの取得に失敗しました。");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void fetchPosts();
        return () => controller.abort();
    }, [slug]); // 🔹 `slug` が変わった場合のみ `fetch` する

    return (
        <Box
            sx={{
                width: "100%",
                padding: "4px",
            }}
        >
            {loading ? (
                <div className="side-menu-loading">記事一覧を読み込み中…</div>
            ) : error ? (
                <div>{error}</div>
            ) : (
                <ArticleList posts={posts} currentId={slug} variant="compact" tagDisplay="first" />
            )}
        </Box>
    );
};

export default SideMenu;
