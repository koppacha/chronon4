import prisma from "@/lib/prisma";

export type RateLimitRule = {
    operation: string;
    identifierHashes: string[];
    limit: number;
    windowMs: number;
    blockMs: number;
};

export async function consumeRateLimit(rule: RateLimitRule, now = new Date()): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const identifiers = Array.from(new Set(rule.identifierHashes.filter(Boolean)));
    if (identifiers.length === 0) return { allowed: true, retryAfterSeconds: 0 };

    return prisma.$transaction(async (tx) => {
        let retryAfterSeconds = 0;

        for (const identifierHash of identifiers) {
            const key = { operation_identifierHash: { operation: rule.operation, identifierHash } };
            const bucket = await tx.rateLimitBucket.findUnique({ where: key });

            if (bucket?.blockedUntil && bucket.blockedUntil > now) {
                // ブロック中の第三者リクエストで期限を無期限に延長しない。
                retryAfterSeconds = Math.max(
                    retryAfterSeconds,
                    Math.ceil((bucket.blockedUntil.getTime() - now.getTime()) / 1000)
                );
                continue;
            }

            const windowExpired = !bucket || now.getTime() - bucket.windowStartedAt.getTime() >= rule.windowMs;
            if (windowExpired) {
                await tx.rateLimitBucket.upsert({
                    where: key,
                    create: { operation: rule.operation, identifierHash, windowStartedAt: now, count: 1 },
                    update: { windowStartedAt: now, count: 1, blockedUntil: null },
                });
                continue;
            }

            if (bucket.count >= rule.limit) {
                const blockedUntil = new Date(now.getTime() + rule.blockMs);
                await tx.rateLimitBucket.update({ where: key, data: { blockedUntil } });
                retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil(rule.blockMs / 1000));
                continue;
            }

            await tx.rateLimitBucket.update({ where: key, data: { count: { increment: 1 } } });
        }

        return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
    });
}
