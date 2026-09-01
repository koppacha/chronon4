import prisma from "@/lib/prisma";
import { getTodayDateOnly } from "@/lib/publication-delay";

const SITE_STARTED_DATE = "2004-09-01";
const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnlyToUtcMs(value: string): number {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
}

export function getOperationDays(now = new Date()): number {
    const today = dateOnlyToUtcMs(getTodayDateOnly(now));
    const started = dateOnlyToUtcMs(SITE_STARTED_DATE);
    return Math.max(1, Math.floor((today - started) / DAY_MS) + 1);
}

export type SiteStatistics = {
    operationDays: number;
    totalCharacters: number;
    averageCharacters: number;
    latestModifiedAt: Date | null;
};

export async function getSiteStatistics(now = new Date()): Promise<SiteStatistics> {
    const aggregate = await prisma.articleCharacterCount.aggregate({
        _sum: { characterCount: true },
        _max: { articleId: true, sourceModifiedAt: true },
    });
    const totalCharacters = aggregate._sum.characterCount ?? 0;
    const latestArticleId = aggregate._max.articleId ?? 0;

    return {
        operationDays: getOperationDays(now),
        totalCharacters,
        averageCharacters: latestArticleId > 0 ? Math.round(totalCharacters / latestArticleId) : 0,
        latestModifiedAt: aggregate._max.sourceModifiedAt ?? null,
    };
}
