"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type LikeStatus = { count: number; liked: boolean };
type LikeStatusContextValue = {
    loaded: boolean;
    authenticated: boolean;
    states: Record<string, LikeStatus>;
};

const LikeStatusContext = createContext<LikeStatusContextValue | null>(null);

export function LikeStatusProvider({ articleIds, children }: { articleIds: string[]; children: ReactNode }) {
    const idsKey = articleIds.filter((id) => /^\d{5}$/.test(id)).join(",");
    const ids = useMemo(() => Array.from(new Set(idsKey.split(",").filter(Boolean))), [idsKey]);
    const [value, setValue] = useState<LikeStatusContextValue>({ loaded: false, authenticated: false, states: {} });

    useEffect(() => {
        let active = true;
        if (ids.length === 0) {
            setValue({ loaded: true, authenticated: false, states: {} });
            return () => { active = false; };
        }
        fetch(`/api/likes/status?ids=${encodeURIComponent(ids.join(","))}`, {
            cache: "no-store",
            credentials: "same-origin",
        })
            .then((response) => response.ok ? response.json() : { authenticated: false, states: {} })
            .then((data) => {
                if (active) setValue({
                    loaded: true,
                    authenticated: Boolean(data?.authenticated),
                    states: data?.states ?? {},
                });
            })
            .catch(() => active && setValue({ loaded: true, authenticated: false, states: {} }));
        return () => { active = false; };
    }, [ids]);

    return <LikeStatusContext.Provider value={value}>{children}</LikeStatusContext.Provider>;
}

export function useLikeStatus(articleId: string): {
    provided: boolean;
    loaded: boolean;
    authenticated: boolean;
    state?: LikeStatus;
} {
    const context = useContext(LikeStatusContext);
    if (!context) return { provided: false, loaded: false, authenticated: false };
    return {
        provided: true,
        loaded: context.loaded,
        authenticated: context.authenticated,
        state: context.states[articleId],
    };
}
