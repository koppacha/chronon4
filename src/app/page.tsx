"use client" // クライアントコンポーネントとして実行

import {useEffect, useRef, useState} from "react"
import Container from "@/components/container"
import { Intro } from "@/components/intro"
import { PostHeader } from "@/components/post-header"
import PostBody from "@/components/post-body"
import SideMenu from "@/components/side-menu"
import { baseUrl } from "@/lib/const"
import markdownToHtml from "@/lib/markdownToHtml";

export default function Index() {
    const [posts, setPosts] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const hasFetched = useRef(false)

    useEffect(() => {
        if (hasFetched.current) return
        hasFetched.current = true

        async function fetchPosts() {
            try {
                const res = await fetch(`${baseUrl}/api/recent`, {
                    cache: "no-store",
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(`Failed to fetch: ${res.status} ${res.statusText} - ${errorData.error}`);
                }
                const data = await res.json();

                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error("No posts found");
                }
                setPosts((prevPosts) => {
                    if (JSON.stringify(prevPosts) === JSON.stringify(data)) {
                        console.log("Data is the same, skipping update.");
                        return prevPosts;
                    }
                    return data;
                });

            } catch (e) {
                console.error("Error Fetching Data:", e);
                setError("記事の取得に失敗しました。しばらくしてから再試行してください。");
            }
        }
        fetchPosts()
    }, [])

    return (
        <Container maxWidth="xl">
            <Intro />
            {error ? (
                <div className="error-message">{error}</div>
            ) : (
                <div style={{width:"100%"}}>
                    {posts.map((post) => (
                        <article key={post.id} className="article">
                            <PostHeader
                                id={post.id}
                                title={post.title}
                                coverImage={post.coverImage}
                                date={post.date}
                                author={post.author}
                                tags={post.tags}
                                categories={post.category}
                            />
                            <PostBody
                                category={post.category}
                                content={post.content}
                                date={post.date}
                            />
                        </article>
                    ))}
                </div>
            )}
            <SideMenu slug={null} />
        </Container>
    )
}