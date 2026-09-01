"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket, faRightToBracket } from "@fortawesome/free-solid-svg-icons";
import {
    authenticatedJsonFetch,
    clearClientSessionCache,
    getClientSession,
} from "@/lib/client-auth";

export function IntroAuthAction() {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getClientSession()
            .then((session) => setAuthenticated(session.authenticated))
            .catch(() => setAuthenticated(false));
    }, []);

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

    if (authenticated === null) return null;
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
                ログアウト<FontAwesomeIcon icon={faRightFromBracket} />
            </button>
        </div>
    );
}

export function GuestAccountMessage() {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        getClientSession()
            .then((session) => setAuthenticated(session.authenticated))
            .catch(() => setAuthenticated(false));
    }, []);

    if (authenticated !== false) return null;
    return (
        <div className="info-container guest-account-message">
            アカウントを作成すると2023年以降の記事を読めるようになります。
            <Link href="/login" aria-label="ログイン・アカウント作成" style={{ textDecoration: 'underline' }}>
                <FontAwesomeIcon icon={faRightToBracket} />
            </Link>
        </div>
    );
}
