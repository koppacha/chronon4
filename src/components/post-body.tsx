"use client"; // クライアントコンポーネント化

import { useEffect, useState } from "react";
import markdownStyles from "./markdown-styles.module.css";
import path from "path";
import markdownToHtml from "@/lib/markdownToHtml";

type Props = {
    category: string;
    content: string;
    date: string;
};

function convertContent(content: string, date: string): string {
    // リンク形式にマッチする正規表現
    const linkRegex = /\[\[(\d{4})-(\d{2})-(\d{2})-(\d{5})]]/g;

    // 画像リンク形式にマッチする正規表現
    const imageRegex = /!\[\[(.+?)\|(\d+?)]]/g;

    // dateからyyyyとmmを取得
    const [year, month] = date.split('-');

    // content未定義対策
    if (typeof content !== "string") {
        return "";
    }

    // 通常のリンクを変換
    content = content.replace(linkRegex, (match, year, month, day, id) => {
        return `<a href="/post/${id}">#${id} / ${year}年${month}月${day}日</a>`;
    });

    // 画像リンクを変換
    content = content.replace(imageRegex, (match, fileName, width) => {
        const imageDir = path.join(year, month, 'images');
        const imagePath = path.join(imageDir, fileName);
        return `<img src="../blog/${imagePath}" width="${width}" alt="${fileName}" />`;
    });
    // ２連改行をpに変換
    content = content.replace(/\n\n/g, "</p><p>")

    // 改行をbrに変換
    return `<p>${content.replace(/(?<!<\/?(li|ol)>)\n/g, "<br/>")}</p>`;
}

export default function PostBody({ category, content, date }: Props) {
    const [convertedContent, setConvertedContent] = useState<string>("");
    useEffect(() => {
        async function convertMarkdown() {
            const htmlContent = await markdownToHtml(content);
            const dateObj = new Date(date ?? "2004-09-01T00:00:00.000Z");
            const finalContent = convertContent(htmlContent, dateObj.toISOString().split('T')[0]);
            setConvertedContent(finalContent);
        }
        convertMarkdown();
    }, [content, date]);

    const categoryStyle = (category === "独り言") ? "category-monologue" : "category-today";

    return (
        <div className={`content-body ${categoryStyle}`}>
            <div
                className={markdownStyles["markdown"]}
                dangerouslySetInnerHTML={{ __html: convertedContent }}
            />
        </div>
    );
}