import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import type { SessionSummary } from "@/lib/session-summary";

export default function UserSummary({ summary }: { summary: SessionSummary }) {
    if (!summary.authenticated) return null;
    const readCount = summary.readCount === undefined ? "取得できません" : `${summary.readCount}本`;
    const likeCount = summary.likeCount === undefined ? "取得できません" : `${summary.likeCount}本`;
    return (
        <aside className="user-summary" aria-label="ログインユーザー情報">
            <div>ログイン中：{summary.displayName}さん</div>
            <div>既読 {readCount} / いいね {likeCount}</div>
            {summary.lastRead && (
                <Link href={`/post/${summary.lastRead.articleId}`}>
                    最後の既読 #{Number(summary.lastRead.articleId)}（{new Date(summary.lastRead.date).toLocaleDateString("ja-JP")}）
                </Link>
            )}
            <div><Link href="/config" aria-label="ユーザー設定">Setting <FontAwesomeIcon icon={faGear} /></Link></div>
        </aside>
    );
}
