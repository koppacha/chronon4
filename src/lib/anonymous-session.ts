export const MAX_ANONYMOUS_SESSION_ID_LENGTH = 512;

/**
 * 運用済みIDを維持するためUUID形式には限定しない。
 * Cookieに不適切な制御文字だけを拒否し、SQLite TEXTの範囲内で入力を制限する。
 */
export function isValidAnonymousSessionId(value: unknown): value is string {
    return typeof value === "string"
        && value.length >= 1
        && value.length <= MAX_ANONYMOUS_SESSION_ID_LENGTH
        && !/[\u0000-\u001f\u007f]/.test(value);
}
