import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCookieValueFromString } from "../src/lib/client-auth";

describe("client auth cookies", () => {
    it("Cookie文字列の並びに関係なく指定名の優先順で選択する", () => {
        const cookies = "anon_csrf=anonymous; chronon_csrf=authenticated";
        assert.equal(getCookieValueFromString(cookies, ["chronon_csrf", "anon_csrf"]), "authenticated");
        assert.equal(getCookieValueFromString(cookies, ["anon_csrf", "chronon_csrf"]), "anonymous");
    });

    it("値に含まれる等号を保持する", () => {
        assert.equal(getCookieValueFromString("token=a%3Db%3D", ["token"]), "a=b=");
    });
});
