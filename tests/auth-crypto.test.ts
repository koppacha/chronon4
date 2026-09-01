import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
    decryptEmail,
    emailHmac,
    encryptEmail,
    hashPassword,
    isValidEmail,
    normalizeEmail,
    tokenHmac,
    validatePassword,
    verifyPassword,
} from "../src/lib/auth-crypto";

before(() => {
    process.env.EMAIL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.EMAIL_HMAC_KEY = "test-email-hmac-key-that-is-at-least-32-bytes";
    process.env.IP_HMAC_KEY = "test-ip-hmac-key-that-is-at-least-32-bytes";
    process.env.TOKEN_HMAC_KEY = "test-token-hmac-key-that-is-at-least-32-bytes";
    process.env.SESSION_HMAC_KEY = "test-session-hmac-key-that-is-at-least-32-bytes";
});
describe("auth crypto", () => {
    it("メールのドメインだけを小文字化し、HMACを安定して生成する", () => {
        assert.equal(normalizeEmail(" User+Alias@Example.COM "), "User+Alias@example.com");
        assert.equal(emailHmac("User+Alias@Example.COM"), emailHmac("User+Alias@example.com"));
        assert.notEqual(emailHmac("User+Alias@example.com"), emailHmac("user+Alias@example.com"));
    });

    it("妥当なメール形式だけを受け付ける", () => {
        assert.equal(isValidEmail("reader@example.com"), true);
        assert.equal(isValidEmail("not-an-email"), false);
        assert.equal(isValidEmail("reader@localhost"), false);
    });

    it("メールを認証付き暗号で往復でき、同じ平文でも暗号文は異なる", () => {
        const first = encryptEmail("reader@example.com");
        const second = encryptEmail("reader@example.com");
        assert.notEqual(first.encrypted, second.encrypted);
        assert.equal(decryptEmail(first.encrypted), "reader@example.com");
    });

    it("パスワードを不可逆ハッシュ化して検証する", async () => {
        const password = "正しい horse battery staple 123";
        const hash = await hashPassword(password);
        assert.match(hash, /^scrypt\$/);
        assert.equal(await verifyPassword(password, hash), true);
        assert.equal(await verifyPassword(`${password}!`, hash), false);
        assert.equal(hash.includes(password), false);
    });

    it("短すぎるパスワードと256バイト超を拒否する", () => {
        assert.ok(validatePassword("short"));
        assert.ok(validatePassword("あ".repeat(86)));
        assert.equal(validatePassword("long-enough-password"), null);
    });

    it("生トークンではなくHMACを生成する", () => {
        const raw = "raw-secret-token";
        const hashed = tokenHmac(raw);
        assert.notEqual(hashed, raw);
        assert.equal(hashed, tokenHmac(raw));
    });
});
