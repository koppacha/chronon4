"use client";

import { FormEvent, useState } from "react";
import { authenticatedJsonFetch } from "@/lib/client-auth";

export default function SettingsForm({ initialHandleName, isAdmin, initialNotice }: {
    initialHandleName: string;
    isAdmin: boolean;
    initialNotice: string;
}) {
    const [handleName, setHandleName] = useState(initialHandleName);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [notice, setNotice] = useState(initialNotice);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const passwordReady = !newPassword && !confirm && !currentPassword || (newPassword === confirm && Array.from(newPassword).length >= 12 && Boolean(currentPassword));

    async function saveProfile(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        const response = await authenticatedJsonFetch("/api/user/settings", {
            method: "POST",
            body: JSON.stringify({ handleName, currentPassword, newPassword, confirm }),
        });
        const data = await response.json();
        setBusy(false);
        setMessage(data.error || "設定を更新しました。");
        if (response.ok && data.passwordChanged) setTimeout(() => window.location.assign("/login"), 1000);
    }

    async function saveNotice() {
        setBusy(true);
        const response = await authenticatedJsonFetch("/api/admin/intro", { method: "POST", body: JSON.stringify({ value: notice }) });
        const data = await response.json();
        setBusy(false);
        setMessage(data.error || "お知らせを更新しました。");
    }

    async function revalidateSite() {
        setBusy(true);
        try {
            const response = await authenticatedJsonFetch("/api/admin/revalidate", {
                method: "POST",
                body: JSON.stringify({}),
            });
            const data = await response.json();
            setMessage(data.error || "記事とキャッシュを更新しました。");
        } catch {
            setMessage("記事とキャッシュを更新できませんでした。");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-card settings-card">
            <form onSubmit={saveProfile}>
                <label htmlFor="handle-name">ハンドルネーム</label>
                <input id="handle-name" maxLength={40} value={handleName} onChange={(event) => setHandleName(event.target.value)} />
                <label htmlFor="current-password">現在のパスワード（パスワード変更時のみ）</label>
                <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                <label htmlFor="config-new-password">新しいパスワード</label>
                <input id="config-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                <label htmlFor="config-confirm-password">新しいパスワード（確認）</label>
                <input id="config-confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
                <button type="submit" disabled={busy || !passwordReady}>設定を保存</button>
            </form>
            {isAdmin && (
                <section>
                    <h2>管理者設定</h2>
                    <label htmlFor="intro-notice">Introのお知らせ</label>
                    <textarea id="intro-notice" maxLength={1000} rows={6} value={notice} onChange={(event) => setNotice(event.target.value)} />
                    <button type="button" disabled={busy || !notice.trim()} onClick={saveNotice}>お知らせを保存</button>
                    <button type="button" disabled={busy} onClick={revalidateSite}>記事とキャッシュを手動更新</button>
                </section>
            )}
            {message && <p role="status" className="form-message">{message}</p>}
        </div>
    );
}
