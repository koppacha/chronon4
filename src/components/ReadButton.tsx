"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquare, faSquareCheck } from "@fortawesome/free-solid-svg-icons";
import { anonymousJsonFetch, authenticatedJsonFetch, getClientSession } from "@/lib/client-auth";
import { shouldTriggerRead } from "@/lib/read-trigger";
import { useReadStatus } from "@/components/read-status";
import type { CSSProperties } from "react";

export default function ReadButton({ articleId, yearColor }: { articleId: string; yearColor?: string }) {
    const [authenticated, setAuthenticated] = useState(false);
    const [available, setAvailable] = useState(false);
    const [read, setRead] = useState(false);
    const [loading, setLoading] = useState(true);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const visibleRef = useRef(false);
    const scrolledRef = useRef(false);
    const sendingRef = useRef(false);
    const automaticBlockedRef = useRef(false);
    const readRef = useRef(false);
    const listStatus = useReadStatus(articleId);

    useEffect(() => { readRef.current = read; }, [read]);

    const sendAction = useCallback(async (manual: boolean) => {
        const automaticReady = shouldTriggerRead({
            available,
            read: readRef.current,
            visible: visibleRef.current,
            scrolled: scrolledRef.current,
            sending: sendingRef.current,
            automaticBlocked: automaticBlockedRef.current,
        });
        if (!available || sendingRef.current || (!manual && !automaticReady)) return;
        const nextRead = manual ? !readRef.current : true;
        sendingRef.current = true;
        if (manual) automaticBlockedRef.current = true;
        try {
            const request = authenticated ? authenticatedJsonFetch : anonymousJsonFetch;
            const response = await request(`/api/reads/${articleId}`, {
                method: "POST",
                body: JSON.stringify({
                    eventId: crypto.randomUUID(),
                    isRead: nextRead,
                    source: manual ? "manual" : "automatic",
                }),
            });
            if (response.ok) {
                const data = await response.json();
                readRef.current = Boolean(data.read);
                setRead(Boolean(data.read));
            } else if (manual) {
                automaticBlockedRef.current = false;
            }
        } catch {
            if (manual) automaticBlockedRef.current = false;
        } finally {
            sendingRef.current = false;
        }
    }, [articleId, authenticated, available]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setAvailable(false);
        setRead(false);
        readRef.current = false;
        visibleRef.current = false;
        scrolledRef.current = false;
        sendingRef.current = false;
        automaticBlockedRef.current = false;
        if (listStatus.provided) {
            if (!listStatus.loaded) return;
            const isAvailable = Boolean(listStatus.available) && typeof listStatus.read === "boolean";
            setRead(Boolean(listStatus.read));
            readRef.current = Boolean(listStatus.read);
            void getClientSession().then((session) => {
                if (!active) return;
                setAuthenticated(session.authenticated);
                setAvailable(isAvailable);
                setLoading(false);
            });
            return () => { active = false; };
        }

        Promise.all([
            getClientSession(),
            fetch(`/api/reads/${articleId}`, { cache: "no-store", credentials: "same-origin" }),
        ])
            .then(async ([session, response]) => ({ session, ok: response.ok, data: await response.json() }))
            .then(({ session, ok, data }) => {
                if (!active) return;
                setAuthenticated(session.authenticated);
                setAvailable(ok && Boolean(data.available));
                setRead(Boolean(data.read));
                readRef.current = Boolean(data.read);
                setLoading(false);
            })
            .catch(() => active && setLoading(false));

        return () => { active = false; };
    }, [articleId, listStatus.available, listStatus.loaded, listStatus.provided, listStatus.read]);

    useEffect(() => {
        if (!available || loading || read) return;
        const button = buttonRef.current;
        if (!button) return;
        let lastScrollY = window.scrollY;
        const observer = new IntersectionObserver((entries) => {
            visibleRef.current = entries.some((entry) => entry.isIntersecting);
            if (visibleRef.current && scrolledRef.current) void sendAction(false);
        }, { threshold: 0 });
        observer.observe(button);
        const onScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY) scrolledRef.current = true;
            lastScrollY = currentScrollY;
            if (visibleRef.current) void sendAction(false);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            observer.disconnect();
            window.removeEventListener("scroll", onScroll);
        };
    }, [available, loading, read, sendAction]);

    if (!available) return null;
    return (
        <Button
            ref={buttonRef}
            size="medium"
            disabled={loading}
            onClick={() => void sendAction(true)}
            startIcon={<FontAwesomeIcon icon={read ? faSquareCheck : faSquare} />}
            className={`read-button ${read ? "is-read" : "is-unread"} ${yearColor && read ? "uses-year-color" : ""}`}
            style={yearColor && read ? { "--interaction-year-color": yearColor } as CSSProperties : undefined}
            aria-pressed={read}
        >
            {read ? "既読" : "未読"}
        </Button>
    );
}
