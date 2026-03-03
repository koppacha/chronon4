import { getCache, setCache } from "@/lib/cache";
import { getAllArchivePostMeta } from "@/lib/archive";

const TAG_STATS_CACHE_KEY = "tagStatsV1";
const TAG_STATS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TagStat = {
    tag: string;
    count: number;
    lastDate: string;
    lastPostId: number;
};

export async function getTagStats(): Promise<TagStat[]> {
    const cached = getCache<TagStat[]>(TAG_STATS_CACHE_KEY);
    if (cached) return cached;

    const posts = await getAllArchivePostMeta();
    const sorted = [...posts].sort((a, b) => a.id - b.id);
    const map = new Map<string, TagStat>();

    for (const post of sorted) {
        const uniqueTags = new Set((post.tags || []).filter(Boolean));
        for (const tag of uniqueTags) {
            const current = map.get(tag);
            if (!current) {
                map.set(tag, {
                    tag,
                    count: 1,
                    lastDate: post.date,
                    lastPostId: post.id,
                });
                continue;
            }

            current.count += 1;
            if (post.id > current.lastPostId) {
                current.lastPostId = post.id;
                current.lastDate = post.date;
            }
        }
    }

    const result = Array.from(map.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.lastPostId !== a.lastPostId) return b.lastPostId - a.lastPostId;
        return a.tag.localeCompare(b.tag, "ja");
    });

    setCache(TAG_STATS_CACHE_KEY, result, TAG_STATS_CACHE_TTL_MS);
    return result;
}

export async function getTopTagStats(n: number): Promise<TagStat[]> {
    const all = await getTagStats();
    if (n === 0) return all;
    return all.slice(0, n);
}
