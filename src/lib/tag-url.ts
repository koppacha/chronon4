const TAG_URL_REPLACE_PATTERN = /[\/\\?#%]/g;

export function tagToUrlKey(tag: string): string {
    return String(tag).replace(TAG_URL_REPLACE_PATTERN, "_");
}
