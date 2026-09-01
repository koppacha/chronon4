import type { Metadata } from "next";
import Container from "@/components/container";
import PasswordResetForm from "@/components/password-reset-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "パスワード再設定",
    robots: { index: false, follow: false, nocache: true },
};

export default async function PasswordResetPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
    const { status } = await searchParams;
    return (
        <Container maxWidth="xl">
            <main className="auth-page">
                <div className="auth-card">
                    <h1>パスワード再設定</h1>
                    <PasswordResetForm ready={status === "ready"} />
                </div>
            </main>
        </Container>
    );
}
