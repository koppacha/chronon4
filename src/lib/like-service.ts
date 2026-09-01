import prisma from "@/lib/prisma";

/** 単一SQL文で切り替え、並行要求間の読み取り後更新競合を避ける。 */
export async function toggleUserLike(userId: number, articleId: string, now = new Date()): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO "UserLike" ("userId", "articleId", "active", "likedAt", "updatedAt")
        VALUES (${userId}, ${articleId}, 1, ${now}, ${now})
        ON CONFLICT("userId", "articleId") DO UPDATE SET
            "likedAt" = CASE WHEN "UserLike"."active" = 0 THEN ${now} ELSE "UserLike"."likedAt" END,
            "active" = CASE WHEN "UserLike"."active" = 1 THEN 0 ELSE 1 END,
            "updatedAt" = ${now}
    `;
}

export async function toggleAnonymousLike(sessionId: string, articleId: string, now = new Date()): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO "Like" ("articleId", "sessionId", "flag", "createdAt")
        VALUES (${articleId}, ${sessionId}, 0, ${now})
        ON CONFLICT("articleId", "sessionId") DO UPDATE SET
            "flag" = CASE WHEN "Like"."flag" = 1 THEN 0 ELSE 1 END
    `;
}
