"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

type ReadStates = Record<string, boolean>;
type ReadStatusContextValue = { loaded: boolean; available: boolean; states: ReadStates };

const ReadStatusContext = createContext<ReadStatusContextValue | null>(null);

export function ReadStatusProvider({ articleIds, children }: { articleIds: string[]; children: ReactNode }) {
    const idsKey = articleIds.filter((id) => /^\d{5}$/.test(id)).join(",");
    const ids = useMemo(() => Array.from(new Set(idsKey.split(",").filter(Boolean))), [idsKey]);
    const [value, setValue] = useState<ReadStatusContextValue>({ loaded: false, available: false, states: {} });

    useEffect(() => {
        let active = true;
        if (ids.length === 0) {
            setValue({ loaded: true, available: false, states: {} });
            return () => { active = false; };
        }
        fetch(`/api/reads/status?ids=${encodeURIComponent(ids.join(","))}`, {
                    cache: "no-store",
                    credentials: "same-origin",
                })
            .then((response) => response.ok ? response.json() : { available: false, states: {} })
            .then((data) => {
                if (active) setValue({ loaded: true, available: Boolean(data?.available), states: data?.states ?? {} });
            })
            .catch(() => active && setValue({ loaded: true, available: false, states: {} }));
        return () => {
            active = false;
        };
    }, [ids]);

    return <ReadStatusContext.Provider value={value}>{children}</ReadStatusContext.Provider>;
}

export function useReadStatus(articleId: string): { provided: boolean; loaded: boolean; available?: boolean; read?: boolean } {
    const context = useContext(ReadStatusContext);
    if (!context) return { provided: false, loaded: false };
    return {
        provided: true,
        loaded: context.loaded,
        available: context.available && Object.prototype.hasOwnProperty.call(context.states, articleId),
        read: Object.prototype.hasOwnProperty.call(context.states, articleId)
            ? context.states[articleId]
            : undefined,
    };
}

export function ReadStatusIcon({ articleId, initialRead }: { articleId: string; initialRead?: boolean }) {
    const contextStatus = useReadStatus(articleId);
    const read = typeof initialRead === "boolean" ? initialRead : contextStatus.read;
    if (read !== true) return null;

    return (
        <span className="list-read-status" role="img" aria-label="既読">
            <FontAwesomeIcon icon={faCheck} />
        </span>
    );
}
