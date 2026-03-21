"use client"; // クライアントコンポーネント化

import { createElement, type ReactNode, useEffect, useState } from "react";
import markdownStyles from "./markdown-styles.module.css";
import markdownToHtml from "@/lib/markdownToHtml";
import { escapeHtmlAttr, sanitizeHtml } from "@/lib/sanitizeHtml";
import ArticleLink from "@/components/article-link";
import { getYearColorClass } from "@/lib/year-color";

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

export default function PostBody({ category, content, date }: Props) {
    const [renderedContent, setRenderedContent] = useState<ReactNode>(null);
    const [fallbackHtml, setFallbackHtml] = useState<string>("");
    useEffect(() => {
        async function convertMarkdown() {
            try {
                const htmlContent = await markdownToHtml(content);
                const dateObj = new Date(date);
                const normalizedDate = Number.isNaN(dateObj.getTime())
                    ? "2004-09-01"
                    : dateObj.toISOString().split('T')[0];
                const finalContent = convertContent(htmlContent, normalizedDate);
                const linkedPostDates = await fetchLinkedPostDates(finalContent);
                const articleYearColorClass = getYearColorClass(date);
                const reactContent = renderHtmlAsReact(finalContent, articleYearColorClass, linkedPostDates);

                if (hasRenderableContent(reactContent)) {
                    setRenderedContent(reactContent);
                    setFallbackHtml("");
                    return;
                }

                setRenderedContent(null);
                setFallbackHtml(finalContent);
            } catch (error) {
                console.error("Failed to render post body:", error);

                const htmlContent = await markdownToHtml(content);
                const dateObj = new Date(date);
                const normalizedDate = Number.isNaN(dateObj.getTime())
                    ? "2004-09-01"
                    : dateObj.toISOString().split('T')[0];
                const finalContent = convertContent(htmlContent, normalizedDate);

                setRenderedContent(null);
                setFallbackHtml(finalContent);
            }
        }
        convertMarkdown();
    }, [content, date]);

    const categoryStyle = (category === "独り言") ? "category-monologue" : "category-today";

    return (
        <div className={`content-body ${categoryStyle}`}>
            <div className={markdownStyles["markdown"]}>
                {fallbackHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: fallbackHtml }} />
                ) : (
                    renderedContent
                )}
            </div>
        </div>
    );
}

function extractLinkedPostIds(html: string): string[] {
    const matches = html.match(/href="\/post\/(\d{5})"/g) ?? [];
    return Array.from(
        new Set(
            matches
                .map((match) => match.match(/\/post\/(\d{5})/)?.[1] ?? null)
                .filter(Boolean)
        )
    ) as string[];
}

async function fetchLinkedPostDates(html: string): Promise<Record<string, string>> {
    const postIds = extractLinkedPostIds(html);
    if (postIds.length === 0) return {};

    const params = new URLSearchParams();
    for (const postId of postIds) {
        params.append("id", postId);
    }

    try {
        const response = await fetch(`/api/post-link-meta?${params.toString()}`);
        if (!response.ok) return {};
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch linked post dates:", error);
        return {};
    }
}

function renderHtmlAsReact(html: string, articleYearColorClass: string, linkedPostDates: Record<string, string>): ReactNode {
    if (typeof window === "undefined") return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    return Array.from(doc.body.childNodes).map((node, index) =>
        renderNode(node, `node-${index}`, articleYearColorClass, linkedPostDates)
    );
}

function renderNode(
    node: ChildNode,
    key: string,
    articleYearColorClass: string,
    linkedPostDates: Record<string, string>
): ReactNode {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes).map((childNode, index) =>
        renderNode(childNode, `${key}-${index}`, articleYearColorClass, linkedPostDates)
    );

    if (tagName === "a") {
        return (
            <ArticleLink
                key={key}
                href={element.getAttribute("href")}
                className={element.getAttribute("class") || undefined}
                linkedPostDates={linkedPostDates}
                rel={element.getAttribute("rel") || undefined}
                target={element.getAttribute("target") || undefined}
                title={element.getAttribute("title") || undefined}
            >
                {children}
            </ArticleLink>
        );
    }

    if (tagName === "strong") {
        return createElement(
            "strong",
            { key, className: mergeClassNames(element.getAttribute("class"), articleYearColorClass) },
            children
        );
    }

    const props = domAttributesToReactProps(element, key);
    if (tagName === "br" || tagName === "img") {
        return createElement(tagName, props);
    }

    return createElement(tagName, props, children);
}

function domAttributesToReactProps(element: HTMLElement, key: string) {
    const props: Record<string, string> = { key };

    for (const attr of Array.from(element.attributes)) {
        if (attr.name === "class") {
            props.className = attr.value;
            continue;
        }
        props[attr.name] = attr.value;
    }

    return props;
}

function mergeClassNames(...classNames: Array<string | null | undefined>): string | undefined {
    const merged = classNames.filter(Boolean).join(" ").trim();
    return merged || undefined;
}

function hasRenderableContent(content: ReactNode): boolean {
    if (content === null || content === undefined || content === false) return false;
    if (typeof content === "string") return content.trim().length > 0;
    if (typeof content === "number") return true;
    if (Array.isArray(content)) return content.some((item) => hasRenderableContent(item));
    return true;
}
