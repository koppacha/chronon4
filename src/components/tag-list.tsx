import React from 'react';
import {getRecentPostsByTag} from "@/lib/api";
import Link from "next/link";

type Post = {
    title: string;
    id: number;
    date: string;
    tags: string[];
    categories: string[];
};

type Props = {
    tag: string;
};

const TagList: React.FC<Props> = ({ tag }) => {

    if(!tag) return <div></div>

    // 記事を取得
    const posts = getRecentPostsByTag(tag, 10)
        .filter((post: { date: string | number | Date; }) => {
            const postDate = new Date(post.date);
            const minDate = new Date('2004-09-01'); // 2004/08/31以前を除外するための最小日付
            const maxDate = new Date(); // 現在の日付を最大日付とする
            return postDate >= minDate && postDate <= maxDate;
        })
        .map((post) => ({
            title: post.title,
            id: parseInt(post.slug.split('-').pop() || '0'), // slugからidを推測
            date: new Date(post.date).toISOString().split('T')[0].replace(/-/g, '/'), // yyyy/mm/dd形式に変換
            tags: post.tags || [],
            categories: post.categories || [],
        }))

    return (
        <div>
            {posts.map((post) => (
                <Link key={post.id} href={`/post/${String(post.id).padStart(5, "0")}`}>
                    <div className="post-block">
                        #{post.id}『{post.title}』（{post.date}）<br/>
                        {post.tags.map((tag:string, index:number) => (
                            <span key={index} className="tag-block">{tag}</span>
                        ))}
                        <span className="tag-block">{post.categories.join(', ')}</span>
                    </div>
                </Link>
                ))}
        </div>
    );
};

export default TagList;