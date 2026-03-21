"use client"

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Box } from "@mui/material";
import { tagToUrlKey } from "@/lib/tag-url";

type TagStat = {
    tag: string;
    count: number;
    lastDate: string;
    lastPostId: number;
};

type Props = {
    n?: number;
    title?: string;
};

const TagStatsList: React.FC<Props> = ({ n = 20, title = "タグ一覧" }) => {
    const [items, setItems] = useState<TagStat[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTags() {
            try {
                const res = await fetch(`/api/tags?n=${n}`, { cache: "no-store" });
                if (!res.ok) {
                    throw new Error(`Failed to fetch tags: ${res.status}`);
                }
                const data = await res.json();
                if (!Array.isArray(data)) {
                    throw new Error("Invalid response");
                }
                setItems(data);
            } catch (e) {
                console.error("Error Fetching Tag Stats:", e);
                setError("タグ一覧の取得に失敗しました。");
            }
        }

        fetchTags();
    }, [n]);

    return (
        <Box sx={{ width: "100%", padding: "4px" }}>
            <div className="list-title">{title}</div>
            {error ? (
                <div>{error}</div>
            ) : (
                <ul style={{ padding: 0, margin: 0 }}>
                    {items.map((item) => {
                        const dt = new Date(item.lastDate);
                        const formatted = Number.isNaN(dt.getTime())
                            ? item.lastDate
                            : dt.toLocaleDateString("ja-JP", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                            });

                        return (
                            <li key={item.tag} className="post-list" style={{ listStyle: "none" }}>
                                <Link href={`/tag/${encodeURIComponent(tagToUrlKey(item.tag))}`}>
                                    <div>
                                        <span className="tag-block">{item.tag}</span>
                                        <span>最終更新: {formatted}</span>
                                        <span style={{ marginLeft: 8 }}>出現: {item.count}</span>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Box>
    );
};

export default TagStatsList;
