import "server-only";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type ReadActor = {
    type: "user" | "anonymous";
    id: string;
};

export type ReadActionSource = "automatic" | "manual";

type RawReadState = { articleId: string; isRead: boolean | number };
type RawReadSummary = { articleId: string; createdAt: Date | string };

export function userReadActor(userId: number): ReadActor {
    return { type: "user", id: String(userId) };
}

export async function getReadStateMap(actor: ReadActor, articleIds: string[]): Promise<Map<string, boolean>> {
    const uniqueIds = Array.from(new Set(articleIds));
    if (uniqueIds.length === 0) return new Map();

    const rows = await prisma.$queryRaw<RawReadState[]>(Prisma.sql`
        SELECT action."articleId", action."isRead"
        FROM "PostReadAction" AS action
        INNER JOIN (
            SELECT "articleId", MAX("id") AS "latestId"
            FROM "PostReadAction"
            WHERE "actorType" = ${actor.type}
              AND "actorId" = ${actor.id}
              AND "articleId" IN (${Prisma.join(uniqueIds)})
            GROUP BY "articleId"
        ) AS latest ON latest."latestId" = action."id"
    `);
    return new Map(rows.map((row) => [row.articleId, Boolean(row.isRead)]));
}

export async function getReadArticleIdSet(actor: ReadActor, articleIds: string[]): Promise<Set<string>> {
    const states = await getReadStateMap(actor, articleIds);
    return new Set(Array.from(states).filter(([, isRead]) => isRead).map(([articleId]) => articleId));
}

export async function getReadState(actor: ReadActor, articleId: string): Promise<boolean> {
    return (await getReadStateMap(actor, [articleId])).get(articleId) ?? false;
}

export async function appendReadAction(input: {
    actor: ReadActor;
    articleId: string;
    eventId: string;
    isRead: boolean;
    source: ReadActionSource;
    referer: string | null;
}): Promise<boolean> {
    try {
        await prisma.postReadAction.create({
            data: {
                actorType: input.actor.type,
                actorId: input.actor.id,
                articleId: input.articleId,
                eventId: input.eventId,
                isRead: input.isRead,
                source: input.source,
                referer: input.referer,
            },
        });
    } catch (error) {
        // eventIdの再送は冪等に扱う。それ以外の制約違反・DB障害は呼出元へ返す。
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
    return getReadState(input.actor, input.articleId);
}

export async function getActiveReadSummary(actor: ReadActor, limit = 50): Promise<{
    count: number;
    recent: Array<{ articleId: string; createdAt: Date }>;
}> {
    const boundedLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    const [countRows, recentRows] = await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
            WITH latest AS (
                SELECT "articleId", "isRead",
                       ROW_NUMBER() OVER (PARTITION BY "articleId" ORDER BY "id" DESC) AS rowNumber
                FROM "PostReadAction"
                WHERE "actorType" = ${actor.type} AND "actorId" = ${actor.id}
            )
            SELECT COUNT(*) AS count FROM latest WHERE rowNumber = 1 AND "isRead" = 1
        `),
        prisma.$queryRaw<RawReadSummary[]>(Prisma.sql`
            WITH latest AS (
                SELECT "articleId", "isRead", "createdAt", "id",
                       ROW_NUMBER() OVER (PARTITION BY "articleId" ORDER BY "id" DESC) AS rowNumber
                FROM "PostReadAction"
                WHERE "actorType" = ${actor.type} AND "actorId" = ${actor.id}
            )
            SELECT "articleId", "createdAt" FROM latest
            WHERE rowNumber = 1 AND "isRead" = 1
            ORDER BY "id" DESC LIMIT ${boundedLimit}
        `),
    ]);
    return {
        count: Number(countRows[0]?.count ?? 0),
        recent: recentRows.map((row) => ({ articleId: row.articleId, createdAt: new Date(row.createdAt) })),
    };
}
