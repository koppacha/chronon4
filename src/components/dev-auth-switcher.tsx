"use client";

import { useEffect, useState } from "react";

type DevRole = "guest" | "user" | "admin";

const OPTIONS: Array<{ role: DevRole; label: string }> = [
    { role: "guest", label: "非ログイン" },
    { role: "user", label: "ログイン" },
    { role: "admin", label: "管理者" },
];

export default function DevAuthSwitcher() {
    const [role, setRole] = useState<DevRole | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        fetch("/api/dev/auth-role", { cache: "no-store", credentials: "same-origin" })
            .then((response) => response.ok ? response.json() : null)
            .then((data) => setRole(data?.role ?? null))
            .catch(() => setRole(null));
    }, []);

    async function changeRole(nextRole: DevRole) {
        setBusy(true);
        try {
            const response = await fetch("/api/dev/auth-role", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: nextRole }),
            });
            if (response.ok) window.location.reload();
        } finally {
            setBusy(false);
        }
    }

    if (!role) return null;
    return (
        <aside className="dev-auth-switcher" aria-label="開発用ログイン状態">
            <strong>DEV認証</strong>
            <div>
                {OPTIONS.map((option) => (
                    <button
                        key={option.role}
                        type="button"
                        aria-pressed={role === option.role}
                        disabled={busy || role === option.role}
                        onClick={() => void changeRole(option.role)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </aside>
    );
}
