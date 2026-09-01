'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faThumbsUp } from '@fortawesome/free-solid-svg-icons'
import { useState, useEffect } from 'react'
import {Button} from "@mui/material";
import { anonymousJsonFetch, authenticatedJsonFetch } from "@/lib/client-auth";
import { useLikeStatus } from "@/components/like-status";

interface Props {
    articleId: string
    yearColor?: string
}

export default function LikeButton({ articleId, yearColor }: Props) {
    const [liked, setLiked]       = useState(false)
    const [count, setCount]       = useState(0)
    const [loading, setLoading]   = useState(true)
    const [authenticated, setAuthenticated] = useState(false)
    const providedStatus = useLikeStatus(articleId)

    // 初期状態取得
    useEffect(() => {
        let active = true
        setLoading(true)
        if (providedStatus.provided) {
            if (!providedStatus.loaded) return () => { active = false }
            setLiked(Boolean(providedStatus.state?.liked))
            setCount(providedStatus.state?.count ?? 0)
            setAuthenticated(providedStatus.authenticated)
            setLoading(false)
            return () => { active = false }
        }
        ;(async () => {
            try {
                const res = await fetch(`/api/likes/${articleId}`, { cache: "no-store", credentials: "same-origin" })
                if (!res.ok) return
                const json = await res.json()
                if (!active) return
                setLiked(Boolean(json.liked))
                setCount(Number(json.count) || 0)
                setAuthenticated(Boolean(json.authenticated))
            } catch {
                // 初期取得失敗時もボタンを再操作可能な状態へ戻す。
            } finally {
                if (active) setLoading(false)
            }
        })()
        return () => { active = false }
    }, [articleId, providedStatus.authenticated, providedStatus.loaded, providedStatus.provided, providedStatus.state])

    const handleToggle = async () => {
        setLoading(true)
        try {
            const csrfFetch = authenticated ? authenticatedJsonFetch : anonymousJsonFetch
            const update = await csrfFetch(`/api/likes/${articleId}`, { method: 'POST', body: '{}' })
            if (!update.ok) return
            const json = await update.json()
            setLiked(Boolean(json.liked))
            setCount(Number(json.count) || 0)
        } catch {
            // 現在の表示を維持し、再押下による再試行を許可する。
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            size="medium"
            disabled={loading}
            onClick={handleToggle}
            startIcon={<FontAwesomeIcon icon={faThumbsUp} />}
            className={`like-button flex items-center gap-1 ${count > 0 ? 'has-likes' : 'has-no-likes'} ${yearColor && liked ? 'uses-year-color' : ''}`}
            style={yearColor && liked ? { "--interaction-year-color": yearColor } as React.CSSProperties : undefined}
            aria-pressed={liked}
        >
            <span>{count > 0 ? count : ''}</span>
        </Button>
    )
}
