import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidAnonymousSessionId, MAX_ANONYMOUS_SESSION_ID_LENGTH } from "../src/lib/anonymous-session";

describe("anonymous session id", () => {
    it("今後発行するrandomUUIDは常に128文字未満で許容される", () => {
        for (let index = 0; index < 100; index += 1) {
            const value = crypto.randomUUID();
            assert.equal(value.length, 36);
            assert.equal(value.length <= 128, true);
            assert.equal(isValidAnonymousSessionId(value), true);
        }
    });

    it("運用済みの長いIDを512文字まで許容する", () => {
        assert.equal(isValidAnonymousSessionId("a".repeat(337)), true);
        assert.equal(isValidAnonymousSessionId("a".repeat(MAX_ANONYMOUS_SESSION_ID_LENGTH)), true);
    });

    it("空文字・513文字・制御文字を拒否する", () => {
        assert.equal(isValidAnonymousSessionId(""), false);
        assert.equal(isValidAnonymousSessionId("a".repeat(MAX_ANONYMOUS_SESSION_ID_LENGTH + 1)), false);
        assert.equal(isValidAnonymousSessionId("legacy\nvalue"), false);
    });
});
