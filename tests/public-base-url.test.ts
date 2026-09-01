import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getPublicBaseUrl } from "../src/lib/public-base-url";

const originalNodeEnv = process.env.NODE_ENV;
const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
const mutableEnv = process.env as Record<string, string | undefined>;

afterEach(() => {
    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
});

describe("public base URL", () => {
    it("公開URLをoriginへ正規化する", () => {
        mutableEnv.NODE_ENV = "production";
        process.env.NEXT_PUBLIC_BASE_URL = "https://chronon.example/path?query=1";
        assert.equal(getPublicBaseUrl(), "https://chronon.example");
    });

    it("本番のHTTP URLを拒否する", () => {
        mutableEnv.NODE_ENV = "production";
        process.env.NEXT_PUBLIC_BASE_URL = "http://chronon.example";
        assert.throws(() => getPublicBaseUrl(), /HTTPS/i);
    });
});
