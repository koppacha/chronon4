const SPACE_PATTERN = / /g;
const SPECIAL_CHAR_PATTERN = /[^\p{L}\p{N}_-]/gu;
const LEGACY_REPLACE_PATTERN = /[\/\\?#%]/g;

export function tagToUrlKey(tag: string): string {
    return String(tag)
        .replace(SPACE_PATTERN, "-")
        .replace(SPECIAL_CHAR_PATTERN, "_");
}

export function tagToLegacyUrlKey(tag: string): string {
    return String(tag).replace(LEGACY_REPLACE_PATTERN, "_");
}

export function tagMatchesUrlKey(tag: string, urlKey: string): boolean {
    return tagToUrlKey(tag) === urlKey || tagToLegacyUrlKey(tag) === urlKey;
}
