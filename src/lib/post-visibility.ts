const HIDDEN_TAG = "準非公開の記事";
const HIDDEN_ID_MAX = 6955;

export function shouldHidePostBody(idOrSlug: string | number, tags: unknown): boolean {
    const id = Number(idOrSlug);
    const hasHiddenTag = Array.isArray(tags) && tags.includes(HIDDEN_TAG);
    const isHiddenById = Number.isFinite(id) && id <= HIDDEN_ID_MAX;
    return hasHiddenTag || isHiddenById;
}
