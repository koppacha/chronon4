"use client";

import { FormEvent, useEffect, useState } from "react";
import { authenticatedJsonFetch } from "@/lib/client-auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authenticated, setAuthenticated] = useState(false);
    const [unverified, setUnverified] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const emailValid = EMAIL_PATTERN.test(email) && email.length <= 254;
    const passwordCharacters = Array.from(password).length;
    const passwordBytes = new TextEncoder().encode(password).length;
    const passwordValid = passwordCharacters >= 12 && passwordBytes <= 256;
    const passwordValidationError = password.length > 0 && !passwordValid
        ? (passwordCharacters < 12 ? "パスワードは12文字以上にしてください。" : "パスワードはUTF-8で256バイト以下にしてください。")
        : "";

    useEffect(() => {
        fetch("/api/auth/session", { cache: "no-store" })
            .then((res) => res.json())
            .then((data) => setAuthenticated(Boolean(data.authenticated)))
            .catch(() => setAuthenticated(false));
    }, []);

    async function call(url: string, body: Record<string, string>) {
        setBusy(true);
        setMessage("");
        try {
            const res = await authenticatedJsonFetch(url, { method: "POST", body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) {
                setUnverified(data.code === "EMAIL_UNVERIFIED");
                setMessage(data.error || "処理に失敗しました。");
                return null;
            }
            setUnverified(false);
            setMessage(data.message || "処理が完了しました。");
            return data;
        } catch {
            setMessage("通信に失敗しました。時間をおいて再試行してください。");
            return null;
        } finally {
            setBusy(false);
        }
    }

    async function login(event: FormEvent) {
        event.preventDefault();
        const data = await call("/api/auth/login", { email, password });
        if (data?.ok) window.location.assign("/");
    }

    async function logout() {
        const data = await call("/api/auth/logout", {});
        if (data?.ok) {
            setAuthenticated(false);
            setMessage("ログアウトしました。");
        }
    }

    return (
        <div className="auth-card">
            <h1>ログイン</h1>
            <form onSubmit={login}>
                <label htmlFor="login-email">メールアドレス</label>
                <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
                <label htmlFor="login-password">パスワード</label>
                <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                />
                {passwordValidationError && <p role="alert" className="form-error">{passwordValidationError}</p>}
                <p className="form-help">アカウントを作成することで最新の利用規約に同意したものとみなします。</p>
                <div className="auth-actions">
                    {authenticated ? (
                        <button type="button" disabled={busy} onClick={logout}>ログアウト</button>
                    ) : (
                        <button type="submit" disabled={busy || !emailValid || !passwordValid}>ログイン</button>
                    )}
                    <button
                        type="button"
                        disabled={busy || !emailValid || !passwordValid}
                        onClick={() => call("/api/auth/signup", { email, password })}
                    >
                        アカウント作成
                    </button>
                    <button
                        type="button"
                        disabled={busy || !emailValid}
                        onClick={() => call("/api/auth/password-reset/request", { email })}
                    >
                        パスワード再発行
                    </button>
                    <button type="button" disabled={busy} onClick={() => window.location.assign("/")}>
                        トップページへ戻る
                    </button>
                </div>
            </form>
            {unverified && (
                <button
                    type="button"
                    disabled={busy || !emailValid || !passwordValid}
                    onClick={() => call("/api/auth/resend-verification", { email, password })}
                >
                    認証メールを再送信
                </button>
            )}
            {message && <p role="status" className="form-message">{message}</p>}
        </div>
    );
}
