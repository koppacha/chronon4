"use client";

import { FormEvent, useState } from "react";
import { getCookieValue } from "@/lib/client-auth";

export default function PasswordResetForm({ ready }: { ready: boolean }) {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const passwordCharacters = Array.from(password).length;
    const passwordBytes = new TextEncoder().encode(password).length;
    const passwordError = password
        ? (passwordCharacters < 12 ? "パスワードは12文字以上にしてください。" : passwordBytes > 256 ? "パスワードはUTF-8で256バイト以下にしてください。" : "")
        : "";
    const confirmError = confirm && password !== confirm ? "確認用パスワードが一致しません。" : "";
    const valid = !passwordError && !confirmError && passwordCharacters >= 12 && password === confirm;

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
            const csrf = getCookieValue(["__Host-chronon_reset_csrf", "chronon_reset_csrf"]);
            const res = await fetch("/api/auth/password-reset/complete", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
                body: JSON.stringify({ password, confirm }),
            });
            const data = await res.json();
            setMessage(data.message || data.error || "処理に失敗しました。");
            if (res.ok) setTimeout(() => window.location.assign("/login"), 1200);
        } catch {
            setMessage("通信に失敗しました。");
        } finally {
            setBusy(false);
        }
    }

    if (!ready) return <p role="alert">再設定URLが無効、期限切れ、または使用済みです。</p>;
    return (
        <form onSubmit={submit}>
            <label htmlFor="new-password">新しいパスワード</label>
            <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <label htmlFor="confirm-password">新しいパスワード（確認）</label>
            <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            {passwordError && <p role="alert" className="form-message">{passwordError}</p>}
            {confirmError && <p role="alert" className="form-message">{confirmError}</p>}
            <button type="submit" disabled={!valid || busy}>パスワードを変更</button>
            {message && <p role="status" className="form-message">{message}</p>}
        </form>
    );
}
