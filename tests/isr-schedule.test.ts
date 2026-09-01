import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { HOME_REVALIDATE_HOUR_JST, HOME_REVALIDATE_MINUTE_JST, getHomeRevalidateTimingStatus } from "../src/lib/isr";

describe("ISR schedule", () => {
    it("記事とキャッシュの再生成時刻は日本時間4:00", () => {
        assert.equal(HOME_REVALIDATE_HOUR_JST, 4);
        assert.equal(HOME_REVALIDATE_MINUTE_JST, 0);
        assert.equal(getHomeRevalidateTimingStatus(new Date("2026-08-18T19:00:00.000Z")).inRecommendedWindow, true);
    });

    it("文字数集計は日本時間5:00", async () => {
        const runner = await readFile(new URL("../scripts/start-runner.mjs", import.meta.url), "utf8");
        assert.match(runner, /const POST_STATS_HOUR_JST = 5;/);
        assert.match(runner, /const POST_STATS_MINUTE_JST = 0;/);
        assert.match(runner, /\(05:00 JST\)/);
    });
});
