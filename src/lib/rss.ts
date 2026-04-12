import { getArchivePostFullList, getAllArchivePostMeta } from "@/lib/archive";
import { baseUrl, siteDescription, siteLanguage, siteTitle } from "@/lib/const";
import markdownToHtml from "@/lib/markdownToHtml";
import { escapeHtmlAttr, sanitizeHtml } from "@/lib/sanitizeHtml";
import { shouldHidePostBody } from "@/lib/post-visibility";

const RSS_POST_LIMIT = 50;
const RSS_BODY_TEXT_LIMIT = 200;

export type RssPost = {
    id: string;
    title: string;
    date: string;
    update: string;
    tags: string[];
    categories: string[];
    content: string;
};

function toAbsoluteUrl(path: string): string {
    return new URL(path, baseUrl).toString();
}

function convertFeedContent(content: string, date: string): string {
    const linkRegex = /\[\[(\d{4})-(\d{2})-(\d{2})-(\d{5})]]/g;
    const imageRegex = /!\[\[(.+?)\|(\d+?)]]/g;
    const [year, month] = date.split("-");

    if (typeof content !== "string") {
        return "";
    }

    let converted = content.replace(linkRegex, (_match, linkYear, linkMonth, day, id) => {
        const safeId = escapeHtmlAttr(id);
        const href = escapeHtmlAttr(toAbsoluteUrl(`/post/${safeId}`));
        return `<a href="${href}">#${safeId} / ${linkYear}年${linkMonth}月${day}日</a>`;
    });

    converted = converted.replace(imageRegex, (_match, fileName, width) => {
        const safeFileName = escapeHtmlAttr(fileName);
        const safeWidth = escapeHtmlAttr(width);
        const imagePath = `${year}/${month}/images/${encodeURIComponent(fileName)}`;
        const src = escapeHtmlAttr(toAbsoluteUrl(`/api/img/${imagePath}`));
        return `<img src="${src}" width="${safeWidth}" alt="${safeFileName}" />`;
    });

    converted = converted.replace(/\n\n/g, "</p><p>");
    converted = converted.replace(/(?<!<\/?(li|ol|ul|h1|h2|h3)>)\n/g, "<br/>");
    converted = converted.replace(/((?:^|<br\/>)\s*「.*」)\s*<br\/>/g, '$1<br class="br-dialogue"/>');

    let html = `<p>${converted}</p>`;
    html = html.replace(/<p>\s*「/g, '<p class="no-indent">「');

    return sanitizeHtml(html);
}

function stripHtml(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function toRfc822(dateString: string): string | null {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toUTCString();
}

function toCdata(value: string): string {
    return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function buildExcerptText(text: string): string {
    const normalized = text.trim();
    if (!normalized) {
        return "...";
    }
    return `${normalized.slice(0, RSS_BODY_TEXT_LIMIT)}...`;
}

function buildExcerptHtml(contentHtml: string): { description: string; contentHtml: string } {
    const imageMatches = contentHtml.match(/<img\b[^>]*>/gi) ?? [];
    const firstImage = imageMatches[0] ?? "";
    const textOnlyHtml = contentHtml.replace(/<img\b[^>]*>/gi, "");
    const excerptText = buildExcerptText(stripHtml(textOnlyHtml));
    const excerptBody = `<p>${escapeXml(excerptText)}</p>`;

    return {
        description: excerptText,
        contentHtml: firstImage ? `<p>${firstImage}</p>${excerptBody}` : excerptBody,
    };
}

export async function getRssPosts(limit = RSS_POST_LIMIT): Promise<RssPost[]> {
    const metas = await getAllArchivePostMeta();
    const visibleMetas = metas
        .filter((post) => !shouldHidePostBody(post.id, post.tags))
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);

    const fullPosts = await getArchivePostFullList(visibleMetas);

    return fullPosts.map((post) => ({
        id: post.id,
        title: post.title,
        date: post.date,
        update: post.update,
        tags: post.tags,
        categories: post.category,
        content: post.content,
    }));
}

export async function renderRssXml(): Promise<string> {
    const posts = await getRssPosts();
    const rssUrl = toAbsoluteUrl("/rss.xml");
    const siteLink = toAbsoluteUrl("/");
    const lastBuildDate = posts
        .map((post) => toRfc822(post.update) ?? toRfc822(post.date))
        .find(Boolean) ?? new Date().toUTCString();

    const items = await Promise.all(
        posts.map(async (post) => {
            const postUrl = toAbsoluteUrl(`/post/${post.id}`);
            const markdownHtml = await markdownToHtml(post.content);
            const safeDate = Number.isNaN(new Date(post.date).getTime())
                ? "2004-09-01"
                : new Date(post.date).toISOString().split("T")[0];
            const feedHtml = convertFeedContent(markdownHtml, safeDate);
            const { description, contentHtml } = buildExcerptHtml(feedHtml);
            const pubDate = toRfc822(post.date) ?? toRfc822(post.update) ?? new Date().toUTCString();
            const categories = [...post.categories, ...post.tags]
                .filter(Boolean)
                .map((category) => `<category>${escapeXml(category)}</category>`)
                .join("");

            return [
                "<item>",
                `<title>${escapeXml(post.title || "Untitled")}</title>`,
                `<link>${escapeXml(postUrl)}</link>`,
                `<guid isPermaLink="true">${escapeXml(postUrl)}</guid>`,
                `<pubDate>${escapeXml(pubDate)}</pubDate>`,
                categories,
                `<description>${escapeXml(description)}</description>`,
                `<content:encoded>${toCdata(contentHtml)}</content:encoded>`,
                "</item>",
            ].join("");
        })
    );

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
        "<channel>",
        `<title>${escapeXml(siteTitle)}</title>`,
        `<link>${escapeXml(siteLink)}</link>`,
        `<description>${escapeXml(siteDescription)}</description>`,
        `<language>${escapeXml(siteLanguage)}</language>`,
        `<lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
        `<atom:link href="${escapeXml(rssUrl)}" rel="self" type="application/rss+xml" />`,
        items.join(""),
        "</channel>",
        "</rss>",
    ].join("");
}
