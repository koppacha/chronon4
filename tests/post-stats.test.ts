import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    countArticleCharacters,
    needsFullArticleStatsRefresh,
    removeExcludedArticleContent,
} from "../scripts/update-post-stats.mjs";
import { getOperationDays } from "../src/lib/site-statistics";

describe("post character statistics", () => {
    it("改行、空白、記号、全半角、絵文字を各1書記素として数える", () => {
        assert.equal(countArticleCharacters("あ A!\n😀"), 6);
        assert.equal(countArticleCharacters("👨‍👩‍👧‍👦"), 1);
        assert.equal(countArticleCharacters("a\r\nb"), 3);
    });

    it("リンク先、画像パス、埋め込みスクリプトを除外して表示文字を残す", () => {
        const source = "[表示](https://example.com) ![代替](image.png)\n<script>alert(1)</script>終";
        assert.equal(removeExcludedArticleContent(source), "表示 代替\n終");
        assert.equal(countArticleCharacters(source), 7);
    });

    it("参照形式とHTML形式でもリンク先・画像パスだけを除外する", () => {
        const source = "[表示][ref] <a href=\"/path\">本文</a> <img src=\"x.png\">\n[ref]: https://example.com";
        assert.equal(removeExcludedArticleContent(source), "表示 本文 \n");
    });

    it("2004年9月1日を運営1日目とする", () => {
        assert.equal(getOperationDays(new Date("2004-09-01T12:00:00+09:00")), 1);
        assert.equal(getOperationDays(new Date("2004-09-02T00:00:00+09:00")), 2);
    });

    it("保存済み記事IDに不足や削除済みIDがあれば全件再集計する", () => {
        assert.equal(needsFullArticleStatsRefresh([1, 2, 3], [1, 2, 3]), false);
        assert.equal(needsFullArticleStatsRefresh([1, 2, 3], [2, 3]), true);
        assert.equal(needsFullArticleStatsRefresh([1, 2, 3], [1, 2, 3, 4]), true);
    });
});
