import type { Metadata } from "next";
import Container from "@/components/container";
import LoginForm from "@/components/login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "ログイン",
    robots: { index: false, follow: false, nocache: true },
};

export default function LoginPage() {
    return (
        <Container maxWidth="xl">
            <main className="auth-page">
                <LoginForm />
            </main>
        </Container>
    );
}
