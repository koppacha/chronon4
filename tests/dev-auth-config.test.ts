import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDevAuthMockEnabledForEnvironment } from "../src/lib/dev-auth-config";

describe("development auth mock", () => {
    it("本番ではフラグ値にかかわらず無効になる", () => {
        assert.equal(isDevAuthMockEnabledForEnvironment("production", undefined), false);
        assert.equal(isDevAuthMockEnabledForEnvironment("production", "1"), false);
    });

    it("開発環境では明示的に0を指定した場合だけ無効になる", () => {
        assert.equal(isDevAuthMockEnabledForEnvironment("development", undefined), true);
        assert.equal(isDevAuthMockEnabledForEnvironment("development", "1"), true);
        assert.equal(isDevAuthMockEnabledForEnvironment("development", "0"), false);
    });
});
