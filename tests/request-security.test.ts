import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rateLimitIdentifiersForIp, sanitizeReferer, sanitizeUserAgent, validateMutationRequest } from "../src/lib/request-security";

describe("request security", () => {
    it("同一生成元のJSON POSTを許可する", () => {
        const request = new Request("http://localhost:3004/api/test", {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: "http://localhost:3004", "Sec-Fetch-Site": "same-origin" },
        });
        assert.deepEqual(validateMutationRequest(request), { ok: true });
    });

    it("cross-siteと単純Content-Typeを拒否する", () => {
        const crossSite = new Request("http://localhost:3004/api/test", {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" },
        });
        assert.equal(validateMutationRequest(crossSite).ok, false);
        const form = new Request("http://localhost:3004/api/test", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "http://localhost:3004" },
        });
        assert.equal(validateMutationRequest(form).ok, false);
    });

    it("リファラからqueryとfragmentを除去する", () => {
        assert.equal(sanitizeReferer("https://example.com/path?token=secret#part"), "https://example.com/path");
        assert.equal(sanitizeReferer("not a url"), null);
    });

    it("UAから制御文字を除去して長さを制限する", () => {
        const value = sanitizeUserAgent(`browser\n${"x".repeat(600)}`);
        assert.equal(value?.includes("\n"), false);
        assert.equal(value?.length, 512);
    });

    it("IPを取得できない場合は共有の送信元バケットを作らない", () => {
        assert.deepEqual(rateLimitIdentifiersForIp(null), []);
        assert.deepEqual(rateLimitIdentifiersForIp("ip-hmac"), ["ip-hmac"]);
    });
});
