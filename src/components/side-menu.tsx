"use client" // 🔹 クライアントコンポーネントにする

import React, { Key, useEffect, useState } from "react";
import { Box } from "@mui/material";
import { baseUrl } from "@/lib/const";

type Props = {
    slug: string;
};

const SideMenu: React.FC<Props> = ({ slug }) => {
    const [posts, setPosts] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let fetchUrl: string;
        if (!slug) {
            fetchUrl = `${baseUrl}/api/recent?n=90&m=10&f=tdg`;
        } else {
            fetchUrl = `${baseUrl}/api/recent?n=51&m=25&f=tdg&a=${slug}`;
        }

        async function fetchPosts() {
            try {
                const res = await fetch(fetchUrl, { cache: "no-store" });

                if (!res.ok) {
                    throw new Error(`Failed to fetch data: ${res.status}`);
                }

                const data = await res.json();
                setPosts(data);
            } catch (e) {
                console.error("Error Fetching Data:", e);
                setError("記事リストの取得に失敗しました。");
            }
        }

        fetchPosts();
    }, [slug]); // 🔹 `slug` が変わった場合のみ `fetch` する

    return (
        <Box
            sx={{
                width: "100%",
                padding: "4px",
            }}
        >
            {error ? (
                <div>{error}</div>
            ) : (
                <ul>
                    {posts.map((post: { id: Key; title: string; date: string; tags: any }) => {
                        const dateFormat: Intl.DateTimeFormatOptions = {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                        };

                        return (
                            <a href={`/post/${post.id}`} key={post.id}>
                                <li className={slug === post.id ? "post-list post-block-current" : "post-list"}>
                                    <span>#{Number(post.id)}</span>
                                    『{post.title}』
                                    <span>({new Date(post.date).toLocaleDateString("ja-JP", dateFormat)})</span>
                                    <br />
                                    <span style={{ textAlign: "right" }} className="tag-block">
                                        {post.tags[0]}
                                    </span>
                                </li>
                            </a>
                        );
                    })}
                </ul>
            )}
        </Box>
    );
};

export default SideMenu;