"use client"; // クライアントコンポーネント化

import { useEffect, useState } from "react";
import markdownStyles from "./markdown-styles.module.css";
import markdownToHtml from "@/lib/markdownToHtml";
import { escapeHtmlAttr, sanitizeHtml } from "@/lib/sanitizeHtml";
import {
    DEFAULT_YEAR_COLOR_CLASS,
    getPostIdFromHref,
    getYearColorClass,
    isExternalHref,
    isInternalPostHref,
} from "@/lib/year-color";

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
        const safeId = escapeHtmlAttr(id);
        return `<a href="/post/${safeId}">#${safeId} / ${year}年${month}月${day}日</a>`;
    });

    // 画像リンクを変換
    content = content.replace(imageRegex, (match, fileName, width) => {
        const safeFileName = escapeHtmlAttr(fileName);
        const safeWidth = escapeHtmlAttr(width);
        const imagePath = `${year}/${month}/images/${encodeURIComponent(fileName)}`;
        return `<img src="/api/img/${imagePath}" width="${safeWidth}" alt="${safeFileName}" />`;
    });
    // ２連改行をpに変換
    content = content.replace(/\n\n/g, "</p><p>")

    // 改行をbrに変換
    content = content.replace(/(?<!<\/?(li|ol|ul|h1|h2|h3)>)\n/g, "<br/>")

    // セリフ行（「で始まり、行末が」で終わる行）の行末 br だけを
    // モバイルでも表示される br（クラス付き）に変換
    content = content
        .replace(/((?:^|<br\/>)\s*「.*」)\s*<br\/>/g, '$1<br class="br-dialogue"/>')

    let html = `<p>${content}</p>`

    // 先頭が「で始まる段落にクラスを付与してインデントを無効化
    html = html.replace(/<p>\s*「/g, '<p class="no-indent">「')

    return sanitizeHtml(html)
}

async function decorateArticleLinks(html: string): Promise<string> {
    if (!html || typeof DOMParser === "undefined") {
        return html;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="content-root">${html}</div>`, "text/html");
    const root = doc.getElementById("content-root");
    if (!root) return html;

    const links = Array.from(root.querySelectorAll("a[href]"));
    const postIds = Array.from(
        new Set(
            links
                .map((link) => getPostIdFromHref(link.getAttribute("href")))
                .filter((id): id is string => Boolean(id))
        )
    );

    let linkedPostDates: Record<string, string> = {};
    if (postIds.length > 0) {
        const query = new URLSearchParams();
        postIds.forEach((id) => query.append("id", id));

        try {
            const response = await fetch(`/api/post-link-meta?${query.toString()}`, { cache: "no-store" });
            if (response.ok) {
                const data = await response.json();
                if (data && typeof data === "object" && !Array.isArray(data)) {
                    linkedPostDates = data as Record<string, string>;
                }
            }
        } catch (error) {
            console.error("Failed to fetch post-link-meta:", error);
        }
    }

    links.forEach((link) => {
        const href = link.getAttribute("href");
        let yearColorClass = DEFAULT_YEAR_COLOR_CLASS;

        if (isInternalPostHref(href)) {
            const postId = getPostIdFromHref(href);
            yearColorClass = getYearColorClass(postId ? linkedPostDates[postId] : undefined);
        }

        link.classList.add(yearColorClass);

        if (isExternalHref(href)) {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");

            if (!link.querySelector(".external-link-icon")) {
                const icon = doc.createElement("span");
                icon.className = "external-link-icon";
                icon.setAttribute("aria-hidden", "true");
                icon.textContent = "↗";
                link.append(" ", icon);
            }
        }
    });

    return root.innerHTML;
}

export default function PostBody({ category, content, date }: Props) {
    const [convertedContent, setConvertedContent] = useState<string>("");
    useEffect(() => {
        async function convertMarkdown() {
            const htmlContent = await markdownToHtml(content);
            const dateObj = new Date(date ?? "2004-09-01T00:00:00.000Z");
            const finalContent = convertContent(htmlContent, dateObj.toISOString().split('T')[0]);
            const decoratedContent = await decorateArticleLinks(finalContent);
            setConvertedContent(decoratedContent);
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
