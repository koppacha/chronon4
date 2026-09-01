import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldTriggerRead } from "../src/lib/read-trigger";

describe("read trigger", () => {
    const base = {
        available: true,
        read: false,
        visible: true,
        scrolled: true,
        sending: false,
        automaticBlocked: false,
    };

    it("未読アイコンが表示され、スクロール済みの場合だけ発火する", () => {
        assert.equal(shouldTriggerRead(base), true);
        assert.equal(shouldTriggerRead({ ...base, visible: false }), false);
        assert.equal(shouldTriggerRead({ ...base, scrolled: false }), false);
    });

    it("匿名セッションでも利用可能なら発火し、利用不可または送信済みなら発火しない", () => {
        assert.equal(shouldTriggerRead(base), true);
        assert.equal(shouldTriggerRead({ ...base, available: false }), false);
        assert.equal(shouldTriggerRead({ ...base, sending: true }), false);
    });

    it("既読時と手動切替後は自動既読を再発火しない", () => {
        assert.equal(shouldTriggerRead({ ...base, read: true }), false);
        assert.equal(shouldTriggerRead({ ...base, automaticBlocked: true }), false);
    });
});
