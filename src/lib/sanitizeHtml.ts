const BLOCKED_TAGS = [
  "script",
  "style",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select"
];

export function sanitizeHtml(unsafeHtml: string): string {
  if (!unsafeHtml) return "";

  let sanitized = unsafeHtml;
  const allowedIframes: string[] = [];

  sanitized = sanitized.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (iframeHtml) => {
    const srcMatch = iframeHtml.match(/\ssrc\s*=\s*(['"])(.*?)\1/i);
    const titleMatch = iframeHtml.match(/\stitle\s*=\s*(['"])(.*?)\1/i);

    if (!srcMatch) return "";

    let srcUrl: URL;
    try {
      srcUrl = new URL(srcMatch[2]);
    } catch {
      return "";
    }

    const host = srcUrl.hostname.toLowerCase();
    const isAllowedHost = host === "www.youtube.com" || host === "youtube.com";
    const isAllowedPath = /^\/embed\/[A-Za-z0-9_-]{11}$/.test(srcUrl.pathname);
    if (!isAllowedHost || !isAllowedPath) {
      return "";
    }

    srcUrl.protocol = "https:";
    srcUrl.username = "";
    srcUrl.password = "";
    srcUrl.hash = "";
    srcUrl.searchParams.set("autoplay", "0");

    const safeSrc = escapeHtmlAttr(srcUrl.toString());
    const safeTitle = escapeHtmlAttr(titleMatch?.[2] ?? "YouTube video player");
    const placeholder = `__ALLOWED_IFRAME_${allowedIframes.length}__`;

    allowedIframes.push(
      `<iframe src="${safeSrc}" title="${safeTitle}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
    );

    return placeholder;
  });

  // Remove active tags that can execute or alter document context.
  for (const tag of BLOCKED_TAGS) {
    const pairTag = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    const singleTag = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    sanitized = sanitized.replace(pairTag, "");
    sanitized = sanitized.replace(singleTag, "");
  }

  // Remove inline event handlers.
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

  // Block javascript: URLs.
  sanitized = sanitized.replace(
    /\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi,
    ' $1="#"'
  );
  sanitized = sanitized.replace(
    /\s(href|src)\s*=\s*javascript:[^\s>]+/gi,
    ' $1="#"'
  );

  for (let i = 0; i < allowedIframes.length; i += 1) {
    sanitized = sanitized.replace(`__ALLOWED_IFRAME_${i}__`, allowedIframes[i]);
  }

  return sanitized;
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
