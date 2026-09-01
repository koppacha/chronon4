import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/container";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "メール認証",
    robots: { index: false, follow: false, nocache: true },
};

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ status?: string; readerNumber?: string }> }) {
    const { status, readerNumber } = await searchParams;
    const messages: Record<string, string> = {
        success: `アカウント作成に成功しました。あなたは${/^\d+$/.test(readerNumber ?? "") ? readerNumber : ""}番目の読者です。`,
        expired: "トークン期限が過ぎたためメール認証に失敗しました。もう一度メール認証を行ってください。",
        invalid: "認証URLが無効、またはすでに使用されています。",
        error: "メール認証に失敗しました。時間をおいて再試行してください。",
    };
    return (
        <Container maxWidth="xl">
            <main className="auth-page">
                <div className="auth-card">
                    <h1>メール認証</h1>
                    <p>{messages[status ?? ""] ?? "認証結果を確認できませんでした。"}</p>
                    <Link className="auth-link-button" href="/">トップページへ戻る</Link>
                </div>
            </main>
        </Container>
    );
}
