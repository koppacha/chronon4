import React from 'react';
import {getPostById, getPostsByDateRange} from "@/lib/api";
import Link from "next/link";

type Post = {
    title: string;
    id: number;
    date: string;
    tags: string[];
    categories: string[];
};

type Props = {
    slug: string;
};

const RelatedList: React.FC<Props> = ({ slug }) => {

    const post = getPostById(slug);
    const postDateObj = new Date(post.date);

    // 90日前と90日後の日付を計算
    const startDate = new Date(postDateObj);
    startDate.setDate(postDateObj.getDate() - 28);

    const endDate = new Date(postDateObj);
    endDate.setDate(postDateObj.getDate() + 28);

    // 日付オブジェクトをISO文字列（yyyy-mm-dd）に変換
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];

    // 記事を取得（2004/08/31以前と未来の日付を除外）
    const posts = getPostsByDateRange(startDateString, endDateString)
        .filter((post: { date: string | number | Date; }) => {
            const postDate = new Date(post.date);
            const minDate = new Date('2023-01-01'); // 2004/08/31以前を除外するための最小日付
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
        .sort((a: { id: number; }, b: { id: number; }) => a.id - b.id); // IDの昇順にソート

    return (
        <div>
            {posts.map((post) => (
                <div key={post.id} className={(post.id === Number(slug)) ? "post-block post-block-current" : "post-block"}>
                    <Link href={`/post/${String(post.id).padStart(5, "0")}`}>#{post.id}「{post.title}」</Link>
                    <span className="tag-block">{post.date}</span> <span className="tag-block">{post.tags.join(',')}</span> <span className="tag-block">{post.categories.join(', ')}</span>
                </div>
                ))}
        </div>
    );
};

export default RelatedList;