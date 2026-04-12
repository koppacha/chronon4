import { icon } from "@fortawesome/fontawesome-svg-core";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import markdownToHtml from "@/lib/markdownToHtml";
import { getVisibleArchivePostMeta } from "@/lib/archive";
import { getCache, setCache } from "@/lib/cache";
import { convertRenderedContent } from "@/lib/post-content";
import { getTodayDateOnly } from "@/lib/publication-delay";
import {
    DEFAULT_YEAR_COLOR_CLASS,
    getPostIdFromHref,
    getYearColorClass,
    isExternalHref,
    isInternalPostHref,
} from "@/lib/year-color";

const RENDERED_BODY_CACHE_TTL_MS = 26 * 60 * 60 * 1000;

type RenderPostBodyHtmlOptions = {
    fileName?: string | null;
    sourceMtimeMs?: number | null;
};

type RenderedBodyCacheEntry = {
    html: string;
    renderDate: string;
    sourceMtimeMs: number | null;
};

const EXTERNAL_LINK_ICON_HTML = icon(faArrowUpRightFromSquare, {
    classes: ["external-link-icon"],
}).html.join("");

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function decorateAnchorTag(
    rawAttributes: string,
    innerHtml: string,
    linkedPostDates: Record<string, string>
): string {
    const hrefMatch = rawAttributes.match(/\shref\s*=\s*(['"])(.*?)\1/i);
    const href = hrefMatch?.[2] ?? null;

    let classNames = "";
    const classMatch = rawAttributes.match(/\sclass\s*=\s*(['"])(.*?)\1/i);
    if (classMatch?.[2]) {
        classNames = classMatch[2].trim();
    }

    let yearColorClass = DEFAULT_YEAR_COLOR_CLASS;
    if (isInternalPostHref(href)) {
        const postId = getPostIdFromHref(href);
        yearColorClass = getYearColorClass(postId ? linkedPostDates[postId] : undefined);
    }

    const classList = Array.from(new Set([classNames, yearColorClass].filter(Boolean).join(" ").split(/\s+/).filter(Boolean)));
    const attrs: string[] = [];

    if (href !== null) {
        attrs.push(`href="${escapeHtml(href)}"`);
    }
    if (classList.length > 0) {
        attrs.push(`class="${escapeHtml(classList.join(" "))}"`);
    }

    let decoratedInnerHtml = innerHtml;
    if (isExternalHref(href)) {
        attrs.push('target="_blank"');
        attrs.push('rel="noopener noreferrer"');

        if (!decoratedInnerHtml.includes("external-link-icon")) {
            decoratedInnerHtml = `${decoratedInnerHtml} ${EXTERNAL_LINK_ICON_HTML}`;
        }
    }

    return `<a ${attrs.join(" ")}>${decoratedInnerHtml}</a>`;
}

async function decorateArticleLinks(html: string): Promise<string> {
    if (!html) return html;

    const hrefMatches = Array.from(html.matchAll(/<a\b[^>]*\shref\s*=\s*(['"])(.*?)\1[^>]*>/gi));
    const postIds = Array.from(
        new Set(
            hrefMatches
                .map((match) => getPostIdFromHref(match[2]))
                .filter((id): id is string => Boolean(id))
        )
    );

    let linkedPostDates: Record<string, string> = {};
    if (postIds.length > 0) {
        const metas = await getVisibleArchivePostMeta();
        linkedPostDates = Object.fromEntries(
            metas
                .filter((post) => postIds.includes(post.idString))
                .map((post) => [post.idString, post.date])
        );
    }

    return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, rawAttributes, innerHtml) => {
        return decorateAnchorTag(rawAttributes, innerHtml, linkedPostDates);
    });
}

export async function renderPostBodyHtml(
    content: string,
    date: string,
    options: RenderPostBodyHtmlOptions = {}
): Promise<string> {
    const fileName = options.fileName ?? null;
    const sourceMtimeMs = options.sourceMtimeMs ?? null;
    const renderDate = getTodayDateOnly();

    if (fileName) {
        const cacheKey = `renderedPostBody:${fileName}`;
        const cached = getCache<RenderedBodyCacheEntry>(cacheKey);
        if (
            cached &&
            cached.renderDate === renderDate &&
            cached.sourceMtimeMs === sourceMtimeMs
        ) {
            return cached.html;
        }

        const markdownHtml = await markdownToHtml(content);
        const finalContent = convertRenderedContent(markdownHtml, date);
        const decoratedContent = await decorateArticleLinks(finalContent);

        setCache(
            cacheKey,
            {
                html: decoratedContent,
                renderDate,
                sourceMtimeMs,
            },
            RENDERED_BODY_CACHE_TTL_MS
        );

        return decoratedContent;
    }

    const markdownHtml = await markdownToHtml(content);
    const finalContent = convertRenderedContent(markdownHtml, date);
    return decorateArticleLinks(finalContent);
}
