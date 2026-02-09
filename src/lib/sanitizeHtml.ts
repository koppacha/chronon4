const BLOCKED_TAGS = [
  "script",
  "style",
  "iframe",
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
