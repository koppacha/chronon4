import { escapeHtmlAttr, sanitizeHtml } from "@/lib/sanitizeHtml";

type ConvertRenderedContentOptions = {
    toAbsoluteUrl?: (path: string) => string;
};

const YOUTUBE_HOSTS = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
];

function extractYouTubeVideoId(urlText: string): string | null {
    let url: URL;

    try {
        url = new URL(urlText);
    } catch {
        return null;
    }

    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.includes(host)) {
        return null;
    }

    if (host === "youtu.be") {
        const shortId = url.pathname.split("/").filter(Boolean)[0] ?? "";
        return /^[A-Za-z0-9_-]{11}$/.test(shortId) ? shortId : null;
    }

    const path = url.pathname;
    const watchId = url.searchParams.get("v");
    if (path === "/watch" && watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) {
        return watchId;
    }

    const pathId = path.split("/").filter(Boolean)[1] ?? "";
    if (
        (path.startsWith("/embed/") || path.startsWith("/shorts/")) &&
        /^[A-Za-z0-9_-]{11}$/.test(pathId)
    ) {
        return pathId;
    }

    return null;
}

function buildYouTubeEmbedHtml(videoId: string): string {
    const safeVideoId = escapeHtmlAttr(videoId);
    const src = `https://www.youtube.com/embed/${safeVideoId}?autoplay=0`;

    return [
        '<div class="youtube-embed">',
        '<iframe',
        ` src="${src}"`,
        ' title="YouTube video player"',
        ' loading="lazy"',
        ' referrerpolicy="strict-origin-when-cross-origin"',
        ' allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"',
        " allowfullscreen",
        "></iframe>",
        "</div>",
    ].join("");
}

function convertYouTubeParagraphs(content: string): string {
    return content.replace(/<p>\s*(https?:\/\/[^\s<]+)\s*<\/p>/gi, (match, urlText) => {
        const videoId = extractYouTubeVideoId(urlText);
        if (!videoId) {
            return match;
        }

        return buildYouTubeEmbedHtml(videoId);
    });
}

export function convertRenderedContent(
    content: string,
    date: string,
    options: ConvertRenderedContentOptions = {}
): string {
    const linkRegex = /\[\[(\d{4})-(\d{2})-(\d{2})-(\d{5})]]/g;
    const imageRegex = /!\[\[(.+?)\|(\d+?)]]/g;
    const [year, month] = date.split("-");
    const toUrl = options.toAbsoluteUrl ?? ((path: string) => path);

    if (typeof content !== "string") {
        return "";
    }

    let converted = content.replace(linkRegex, (_match, linkYear, linkMonth, day, id) => {
        const safeId = escapeHtmlAttr(id);
        const href = escapeHtmlAttr(toUrl(`/post/${safeId}`));
        return `<a href="${href}">#${safeId} / ${linkYear}年${linkMonth}月${day}日</a>`;
    });

    converted = converted.replace(imageRegex, (_match, fileName, width) => {
        const safeFileName = escapeHtmlAttr(fileName);
        const safeWidth = escapeHtmlAttr(width);
        const imagePath = `${year}/${month}/images/${encodeURIComponent(fileName)}`;
        const src = escapeHtmlAttr(toUrl(`/api/img/${imagePath}`));
        return `<img src="${src}" width="${safeWidth}" alt="${safeFileName}" />`;
    });

    converted = converted.replace(/\n\n/g, "</p><p>");
    converted = converted.replace(/(?<!<\/?(li|ol|ul|h1|h2|h3)>)\n/g, "<br/>");
    converted = converted.replace(/((?:^|<br\/>)\s*「.*」)\s*<br\/>/g, '$1<br class="br-dialogue"/>');

    let html = `<p>${converted}</p>`;
    html = html.replace(/<p>\s*「/g, '<p class="no-indent">「');
    html = convertYouTubeParagraphs(html);

    return sanitizeHtml(html);
}
