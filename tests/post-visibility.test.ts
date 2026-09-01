import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    decidePostAccess,
    filterPostsForUnanchoredRecentList,
    getLatestPublishedPostIds,
    selectLatestPublishedPostIds,
    SEMI_PRIVATE_TAG,
    SPECIAL_PUBLIC_TAG,
} from "../src/lib/post-visibility";

const NOW = new Date("2026-08-09T12:00:00+09:00");
const PUBLISHED = "2026-08-01";

describe("post visibility", () => {
    it("全ロールと公開条件の組み合わせを優先順位どおり判定する", () => {
        const latestIds = new Set([7000]);
        const roles = [
            { name: "guest", value: 0 },
            { name: "user", value: 1 },
            { name: "admin", value: 10 },
        ] as const;
        const cases = [
            { name: "掲載前", post: { id: 7000, tags: [], date: "2026-08-10" }, expected: [false, false, false] },
            { name: "準非公開", post: { id: 7000, tags: [SEMI_PRIVATE_TAG], date: PUBLISHED }, expected: [false, false, true] },
            { name: "準非公開かつ特別公開", post: { id: 7000, tags: [SEMI_PRIVATE_TAG, SPECIAL_PUBLIC_TAG], date: PUBLISHED }, expected: [false, false, true] },
            { name: "特別公開の旧記事", post: { id: 6954, tags: [SPECIAL_PUBLIC_TAG], date: PUBLISHED }, expected: [true, true, true] },
            { name: "通常の旧記事", post: { id: 6954, tags: [], date: PUBLISHED }, expected: [false, false, true] },
            { name: "最新10本", post: { id: 7000, tags: [], date: PUBLISHED }, expected: [true, true, true] },
            { name: "最新10本以外", post: { id: 6999, tags: [], date: PUBLISHED }, expected: [false, true, true] },
        ] as const;

        for (const testCase of cases) {
            roles.forEach((role, index) => {
                assert.equal(
                    decidePostAccess(testCase.post, role.value, latestIds, NOW).canViewBody,
                    testCase.expected[index],
                    `${testCase.name}/${role.name}`,
                );
            });
        }
    });

    it("実在する記事を降順に10件選ぶ", () => {
        const ids = getLatestPublishedPostIds(Array.from({ length: 25 }, (_, index) => ({ id: 7000 + index })));
        assert.equal(ids.size, 10);
        assert.equal(ids.has(7024), true);
        assert.equal(ids.has(7014), false);
    });

    it("認可用の最新10本は現在の掲載日を読み直し、掲載前記事を除外する", async () => {
        const candidates = Array.from({ length: 12 }, (_, index) => ({ id: 7000 + index, fileName: `${7000 + index}.md` }));
        const ids = await selectLatestPublishedPostIds(candidates, async (fileName) =>
            fileName === "7011.md" ? "2026-08-10" : PUBLISHED, NOW);
        assert.equal(ids.size, 10);
        assert.equal(ids.has(7011), false);
        assert.equal(ids.has(7001), true);
        assert.equal(ids.has(7000), false);
    });

    it("掲載遅延をすべてのロールより優先する", () => {
        const access = decidePostAccess({ id: 9999, tags: [SPECIAL_PUBLIC_TAG], date: "2026-08-03" }, 10, new Set([9999]), NOW);
        assert.deepEqual(access, { published: false, canViewBody: false, reason: "not_published" });
    });

    it("準非公開を特別公開より優先する", () => {
        const post = { id: 7000, tags: [SPECIAL_PUBLIC_TAG, SEMI_PRIVATE_TAG], date: PUBLISHED };
        assert.equal(decidePostAccess(post, 0, new Set([7000]), NOW).canViewBody, false);
        assert.equal(decidePostAccess(post, 1, new Set([7000]), NOW).canViewBody, false);
        assert.equal(decidePostAccess(post, 10, new Set([7000]), NOW).canViewBody, true);
    });

    it("特別公開は6954以前でもゲストが閲覧できる", () => {
        assert.equal(decidePostAccess({ id: 6954, tags: [SPECIAL_PUBLIC_TAG], date: PUBLISHED }, 0, new Set(), NOW).canViewBody, true);
    });

    it("6954以前は管理者だけ、6955は条件に含めない", () => {
        assert.equal(decidePostAccess({ id: 6954, tags: [], date: PUBLISHED }, 1, new Set(), NOW).canViewBody, false);
        assert.equal(decidePostAccess({ id: 6954, tags: [], date: PUBLISHED }, 10, new Set(), NOW).canViewBody, true);
        assert.equal(decidePostAccess({ id: 6955, tags: [], date: PUBLISHED }, 1, new Set(), NOW).canViewBody, true);
    });

    it("最新10本はゲスト、それ以外はログインユーザーだけ閲覧できる", () => {
        const latestTen = new Set(Array.from({ length: 10 }, (_, index) => 7001 + index));
        assert.equal(decidePostAccess({ id: 7010, tags: [], date: PUBLISHED }, 0, latestTen, NOW).canViewBody, true);
        assert.equal(decidePostAccess({ id: 7001, tags: [], date: PUBLISHED }, 0, latestTen, NOW).canViewBody, true);
        assert.equal(decidePostAccess({ id: 7000, tags: [], date: PUBLISHED }, 0, latestTen, NOW).canViewBody, false);
        assert.equal(decidePostAccess({ id: 7000, tags: [], date: PUBLISHED }, 1, latestTen, NOW).canViewBody, true);
    });

    it("非自然数の記事番号は管理者だけ閲覧できる", () => {
        assert.equal(decidePostAccess({ id: 0, tags: [], date: PUBLISHED }, 1, new Set(), NOW).canViewBody, false);
        assert.equal(decidePostAccess({ id: -1, tags: [], date: PUBLISHED }, 10, new Set(), NOW).canViewBody, true);
    });

    it("トップの最新一覧はゲスト時だけ本文を閲覧できる記事へ絞る", () => {
        const posts = [
            { id: 7002, tags: [], date: PUBLISHED },
            { id: 7001, tags: [SEMI_PRIVATE_TAG], date: PUBLISHED },
            { id: 6954, tags: [SPECIAL_PUBLIC_TAG], date: PUBLISHED },
            { id: 7000, tags: [], date: PUBLISHED },
        ];
        const guestPosts = filterPostsForUnanchoredRecentList(posts, 0, new Set([7002]));
        assert.deepEqual(guestPosts.map((post) => post.id), [7002, 6954]);
        assert.equal(filterPostsForUnanchoredRecentList(posts, 1, new Set([7002])).length, posts.length);
    });
});
