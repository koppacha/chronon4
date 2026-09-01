"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { getClientSession } from "@/lib/client-auth";

type Summary = {
    authenticated: boolean;
    displayName?: string;
    likeCount?: number;
    readCount?: number;
    lastRead?: { articleId: string; date: string } | null;
};

export default function UserSummary() {
    const [summary, setSummary] = useState<Summary | null>(null);

    useEffect(() => {
        getClientSession()
            .then(setSummary)
            .catch(() => setSummary({ authenticated: false }));
    }, []);

    if (!summary?.authenticated) return null;
    return (
        <aside className="user-summary" aria-label="ログインユーザー情報">
            <div>ログイン中：{summary.displayName}さん</div>
            <div>既読 {summary.readCount ?? 0}本 / いいね {summary.likeCount ?? 0}本</div>
            {summary.lastRead && (
                <Link href={`/post/${summary.lastRead.articleId}`}>
                    最後の既読 #{Number(summary.lastRead.articleId)}（{new Date(summary.lastRead.date).toLocaleDateString("ja-JP")}）
                </Link>
            )}
            <div><Link href="/config" aria-label="ユーザー設定">Setting <FontAwesomeIcon icon={faGear} /></Link></div>
        </aside>
    );
}
