type CacheItem<T> = {
    value: T;
    expiry: number; // タイムスタンプ（ミリ秒単位）
};

const cache = new Map<string, CacheItem<any>>();

/**
 * キャッシュからデータを取得する
 */
export function getCache<T>(key: string): T | null {
    const item = cache.get(key);
    if (item && Date.now() < item.expiry) {
        return item.value;
    }
    // 有効期限切れの場合、キャッシュを削除
    if (item) {
        cache.delete(key);
    }
    return null;
}

/**
 * キャッシュにデータを保存する
 */
export function setCache<T>(key: string, value: T, ttl: number): void {
    cache.set(key, { value, expiry: Date.now() + ttl });
}
