'use client'

import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faThumbsUp } from '@fortawesome/free-solid-svg-icons'
import {Button} from "@mui/material";

interface Props {
    articleId: string
}

export default function LikeButton({ articleId }: Props) {
    const [liked, setLiked]       = useState(false)
    const [count, setCount]       = useState(0)
    const [loading, setLoading]   = useState(true)

    // 初期状態取得
    useEffect(() => {
        ;(async () => {
            const res = await fetch(`/api/likes/${articleId}`)
            const json = await res.json()
            setLiked(json.liked)
            setCount(json.count)
            setLoading(false)
        })()
    }, [articleId])

    const handleToggle = async () => {
        setLoading(true)
        await fetch(`/api/likes/${articleId}`, { method: 'POST' })
        // 再取得
        const res = await fetch(`/api/likes/${articleId}`)
        const json = await res.json()
        setLiked(json.liked)
        setCount(json.count)
        setLoading(false)
    }

    return (
        <Button
            size="medium"
            disabled={loading}
            onClick={handleToggle}
            startIcon={<FontAwesomeIcon icon={faThumbsUp} />}
            className={`like-button flex items-center gap-1 ${
                liked ? 'text-blue-600' : 'text-gray-500'
            }`}
        >
            <span>{count > 0 ? count : ''}</span>
        </Button>
    )
}