import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSelectArchiveYear, canViewArchiveHeader, selectCenteredWindow } from "../src/lib/archive-navigation";

describe("archive navigation", () => {
    it("非ログインユーザーにはヘッダーを表示しない", () => {
        assert.equal(canViewArchiveHeader(0), false);
        assert.equal(canSelectArchiveYear(2026, 0), false);
    });

    it("一般ログインユーザーは2023年以降だけ選択できる", () => {
        assert.equal(canViewArchiveHeader(1), true);
        assert.equal(canSelectArchiveYear(2022, 1), false);
        assert.equal(canSelectArchiveYear(2023, 1), true);
    });

    it("管理者は2004年以降をすべて選択できる", () => {
        assert.equal(canViewArchiveHeader(10), true);
        assert.equal(canSelectArchiveYear(2004, 10), true);
        assert.equal(canSelectArchiveYear(2022, 10), true);
        assert.equal(canSelectArchiveYear(2026, 10), true);
    });
});

describe("centered article window", () => {
    const posts = Array.from({ length: 100 }, (_, index) => index + 1);

    it("中央では対象記事の前後25本を含む51本を返す", () => {
        const selected = selectCenteredWindow(posts, 49, 51, 25);
        assert.deepEqual(selected, Array.from({ length: 51 }, (_, index) => index + 25));
    });

    it("最新側の不足を古い側で補填する", () => {
        const selected = selectCenteredWindow(posts, 89, 51, 25);
        assert.equal(selected.length, 51);
        assert.equal(selected[0], 50);
        assert.equal(selected.at(-1), 100);
    });

    it("最古側の不足を新しい側で補填する", () => {
        const selected = selectCenteredWindow(posts, 10, 51, 25);
        assert.equal(selected.length, 51);
        assert.equal(selected[0], 1);
        assert.equal(selected.at(-1), 51);
    });
});
