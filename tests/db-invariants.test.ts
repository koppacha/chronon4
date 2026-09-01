import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { after, before, describe, it } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
let prisma: import("@prisma/client").PrismaClient | null = null;
let consumeRateLimit: typeof import("../src/lib/rate-limit").consumeRateLimit | null = null;
let toggleUserLike: typeof import("../src/lib/like-service").toggleUserLike | null = null;
let toggleAnonymousLike: typeof import("../src/lib/like-service").toggleAnonymousLike | null = null;
let createUnverifiedUser: typeof import("../src/lib/auth-service").createUnverifiedUser | null = null;

before(async () => {
    if (!testDatabaseUrl) return;
    process.env.DATABASE_URL = testDatabaseUrl;
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    ({ consumeRateLimit } = await import("../src/lib/rate-limit"));
    ({ toggleUserLike, toggleAnonymousLike } = await import("../src/lib/like-service"));
    ({ createUnverifiedUser } = await import("../src/lib/auth-service"));
});

after(async () => {
    await prisma?.$disconnect();
});

describe("database invariants", { skip: !testDatabaseUrl }, () => {
    it("同一メールの並行signupを一人の作成と既存扱いへ収束させる", async () => {
        assert.ok(prisma && createUnverifiedUser);
        const suffix = crypto.randomUUID();
        const data = {
            emailEncrypted: `encrypted-${suffix}`,
            emailKeyVersion: 1,
            emailHmac: `parallel-email-${suffix}`,
            passwordHash: "hash",
        };
        const results = await Promise.all([
            createUnverifiedUser(data),
            createUnverifiedUser(data),
        ]);
        assert.equal(results.filter(Boolean).length, 1);
        assert.equal(results.filter((result) => result === null).length, 1);
        assert.equal(await prisma.user.count({ where: { emailHmac: data.emailHmac } }), 1);
    });

    it("メールHMACとreaderNumberの重複をDBで拒否する", async () => {
        assert.ok(prisma);
        const suffix = crypto.randomUUID();
        const readerNumber = 1_000_000 + randomInt(1_000_000_000);
        const first = await prisma.user.create({
            data: { emailEncrypted: `encrypted-${suffix}`, emailHmac: `email-${suffix}`, passwordHash: "hash", readerNumber },
        });
        await assert.rejects(() => prisma!.user.create({
            data: { emailEncrypted: "different", emailHmac: first.emailHmac, passwordHash: "hash" },
        }));
        await assert.rejects(() => prisma!.user.create({
            data: { emailEncrypted: "different", emailHmac: `other-${suffix}`, passwordHash: "hash", readerNumber },
        }));
    });

    it("UserLikeと既読状態を記事単位で一意に保つ", async () => {
        assert.ok(prisma);
        const suffix = crypto.randomUUID();
        const user = await prisma.user.create({
            data: { emailEncrypted: `encrypted-${suffix}`, emailHmac: `email-${suffix}`, passwordHash: "hash" },
        });
        await prisma.userLike.create({ data: { userId: user.id, articleId: "07000" } });
        await assert.rejects(() => prisma!.userLike.create({ data: { userId: user.id, articleId: "07000" } }));
        await prisma.userPostRead.create({ data: { userId: user.id, articleId: "07000" } });
        await assert.rejects(() => prisma!.userPostRead.create({ data: { userId: user.id, articleId: "07000" } }));
        await prisma.like.create({ data: { articleId: "07000", sessionId: suffix } });
        await assert.rejects(() => prisma!.like.create({ data: { articleId: "07000", sessionId: suffix } }));
    });

    it("同じ閲覧eventIdの再送をDBで拒否する", async () => {
        assert.ok(prisma);
        const suffix = crypto.randomUUID();
        const user = await prisma.user.create({
            data: { emailEncrypted: `encrypted-${suffix}`, emailHmac: `email-${suffix}`, passwordHash: "hash" },
        });
        const eventId = crypto.randomUUID();
        await prisma.readEvent.create({ data: { userId: user.id, articleId: "07000", eventId } });
        await assert.rejects(() => prisma!.readEvent.create({ data: { userId: user.id, articleId: "07000", eventId } }));
    });

    it("既読操作を追記し、最新操作だけを有効状態にする", async () => {
        assert.ok(prisma);
        const actorId = crypto.randomUUID();
        for (const isRead of [true, false, true]) {
            await prisma.postReadAction.create({
                data: {
                    actorType: "anonymous",
                    actorId,
                    articleId: "07003",
                    eventId: crypto.randomUUID(),
                    isRead,
                    source: "manual",
                },
            });
        }
        const actions = await prisma.postReadAction.findMany({
            where: { actorType: "anonymous", actorId, articleId: "07003" },
            orderBy: { id: "asc" },
        });
        assert.deepEqual(actions.map((action) => action.isRead), [true, false, true]);
        assert.equal(actions.at(-1)?.isRead, true);
        await assert.rejects(() => prisma!.postReadAction.create({
            data: {
                actorType: "anonymous",
                actorId,
                articleId: "07004",
                eventId: actions[0].eventId,
                isRead: false,
                source: "manual",
            },
        }));
    });

    it("Likeの切替を単一DB文で交互に反映する", async () => {
        assert.ok(prisma && toggleUserLike && toggleAnonymousLike);
        const suffix = crypto.randomUUID();
        const user = await prisma.user.create({
            data: { emailEncrypted: `encrypted-${suffix}`, emailHmac: `email-${suffix}`, passwordHash: "hash" },
        });
        await toggleUserLike(user.id, "07001");
        assert.equal((await prisma.userLike.findUniqueOrThrow({ where: { userId_articleId: { userId: user.id, articleId: "07001" } } })).active, true);
        await toggleUserLike(user.id, "07001");
        assert.equal((await prisma.userLike.findUniqueOrThrow({ where: { userId_articleId: { userId: user.id, articleId: "07001" } } })).active, false);

        await toggleAnonymousLike(suffix, "07001");
        assert.equal((await prisma.like.findUniqueOrThrow({ where: { articleId_sessionId: { articleId: "07001", sessionId: suffix } } })).flag, false);
        await toggleAnonymousLike(suffix, "07001");
        assert.equal((await prisma.like.findUniqueOrThrow({ where: { articleId_sessionId: { articleId: "07001", sessionId: suffix } } })).flag, true);

        const legacyLongSessionId = `legacy-${"a".repeat(330)}`;
        assert.equal(legacyLongSessionId.length, 337);
        await toggleAnonymousLike(legacyLongSessionId, "07005");
        assert.equal((await prisma.like.findUniqueOrThrow({
            where: { articleId_sessionId: { articleId: "07005", sessionId: legacyLongSessionId } },
        })).flag, false);
        await toggleAnonymousLike(legacyLongSessionId, "07005");
        assert.equal((await prisma.like.findUniqueOrThrow({
            where: { articleId_sessionId: { articleId: "07005", sessionId: legacyLongSessionId } },
        })).flag, true);

        await Promise.all([
            toggleUserLike(user.id, "07002"),
            toggleUserLike(user.id, "07002"),
        ]);
        assert.equal((await prisma.userLike.findUniqueOrThrow({ where: { userId_articleId: { userId: user.id, articleId: "07002" } } })).active, false);
    });

    it("ブロック中の再試行で失効日時を延長しない", async () => {
        assert.ok(prisma && consumeRateLimit);
        const operation = `rate-test-${crypto.randomUUID()}`;
        const identifier = crypto.randomUUID();
        const now = new Date("2026-08-09T00:00:00.000Z");
        await consumeRateLimit({ operation, identifierHashes: [identifier], limit: 1, windowMs: 60_000, blockMs: 60_000 }, now);
        await consumeRateLimit({ operation, identifierHashes: [identifier], limit: 1, windowMs: 60_000, blockMs: 60_000 }, new Date(now.getTime() + 1_000));
        const blocked = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { operation_identifierHash: { operation, identifierHash: identifier } } });
        await consumeRateLimit({ operation, identifierHashes: [identifier], limit: 1, windowMs: 60_000, blockMs: 60_000 }, new Date(now.getTime() + 30_000));
        const retried = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { operation_identifierHash: { operation, identifierHash: identifier } } });
        assert.equal(retried.blockedUntil?.getTime(), blocked.blockedUntil?.getTime());
    });
});
