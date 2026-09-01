"use client";

import { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket, faRightToBracket } from "@fortawesome/free-solid-svg-icons";
import {
    authenticatedJsonFetch,
    clearClientSessionCache,
} from "@/lib/client-auth";

export function IntroAuthAction({ authenticated }: { authenticated: boolean }) {
    const [busy, setBusy] = useState(false);

    async function logout() {
        setBusy(true);
        try {
            const response = await authenticatedJsonFetch("/api/auth/logout", {
                method: "POST",
                body: "{}",
            });
            if (response.ok) {
                clearClientSessionCache();
                window.location.reload();
            }
        } finally {
            setBusy(false);
        }
    }

    if (!authenticated) {
        return (
            <div className="intro-link-item">
                <Link href="/login">Login<FontAwesomeIcon icon={faRightToBracket} /></Link>
            </div>
        );
    }
    return (
        <div className="intro-link-item">
            <button type="button" className="intro-link-button" disabled={busy} onClick={() => void logout()}>
                Logout<FontAwesomeIcon icon={faRightFromBracket} />
            </button>
        </div>
    );
}

export function GuestAccountMessage({ authenticated, unavailable = false }: {
    authenticated: boolean;
    unavailable?: boolean;
}) {
    if (authenticated || unavailable) return null;
    return (
        <Link
            className="info-container guest-account-message"
            href="/login"
            aria-label="ログイン・アカウント作成"
        >
            <span>アカウントを作成すると2023年以降の記事を読めるようになります。</span>
            <span className="guest-account-login"><FontAwesomeIcon icon={faRightToBracket} />ログイン</span>
        </Link>
    );
}
