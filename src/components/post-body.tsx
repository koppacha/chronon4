"use client"; // クライアントコンポーネント化

import { icon } from "@fortawesome/fontawesome-svg-core";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";
import markdownStyles from "./markdown-styles.module.css";
import markdownToHtml from "@/lib/markdownToHtml";
import { convertRenderedContent } from "@/lib/post-content";
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

const EXTERNAL_LINK_ICON_HTML = icon(faArrowUpRightFromSquare, {
    classes: ["external-link-icon"],
}).html.join("");

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
                link.insertAdjacentHTML("beforeend", ` ${EXTERNAL_LINK_ICON_HTML}`);
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
            const dateObj = new Date(date || "2004-09-01T00:00:00.000Z");
            const safeDate = Number.isNaN(dateObj.getTime())
                ? "2004-09-01"
                : dateObj.toISOString().split('T')[0];
            const finalContent = convertRenderedContent(htmlContent, safeDate);
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
