import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { PrismaClient } from "@prisma/client";

const BLOG_DIRECTORY = process.env.BLOG_DIRECTORY || path.join(process.cwd(), "blog");
const RECENT_MONTHS = 1;
const FILE_NAME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})-(\d{1,5})\.md$/;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
process.env.DATABASE_URL ||= `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
const graphemeSegmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("ja", { granularity: "grapheme" })
    : null;

function startOfRecentPeriod(now = new Date()) {
    const jst = new Date(now.getTime() + JST_OFFSET_MS);
    return new Date(Date.UTC(
        jst.getUTCFullYear(),
        jst.getUTCMonth() - RECENT_MONTHS,
        jst.getUTCDate(),
    ));
}

function getArticleInfo(fileName) {
    const match = path.basename(fileName).match(FILE_NAME_PATTERN);
    if (!match) return null;
    const articleId = Number(match[4]);
    const articleDate = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
    if (!Number.isSafeInteger(articleId) || articleId <= 0 || Number.isNaN(articleDate.getTime())) return null;
    return { articleId, articleDate };
}

async function getPostFiles() {
    const years = await fs.readdir(BLOG_DIRECTORY, { withFileTypes: true });
    const files = [];

    async function collect(directory) {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await collect(entryPath);
            } else if (entry.isFile() && entry.name.endsWith(".md") && getArticleInfo(entry.name)) {
                files.push(entryPath);
            }
        }
    }

    for (const year of years.filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))) {
        await collect(path.join(BLOG_DIRECTORY, year.name));
    }

    return files;
}

export function removeExcludedArticleContent(markdown) {
    return markdown
        .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
        .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "")
        .replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, "")
        .replace(/<(?:iframe|embed)\b[^>]*\/?\s*>/gi, "")
        .replace(/<img\b[^>]*\/?\s*>/gi, "")
        .replace(/<\/?a\b[^>]*>/gi, "")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/!\[([^\]]*)\]\[[^\]]*\]/g, "$1")
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
        .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gim, "")
        .replace(/!\[\[[^\]]+\]\]/g, "")
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/<(?:https?|mailto):[^>]+>/gi, "")
        .replace(/https?:\/\/[^\s<>()]+/g, "");
}

export function countArticleCharacters(markdown) {
    const countable = removeExcludedArticleContent(markdown).replace(/\r\n?/g, "\n");
    if (graphemeSegmenter) {
        let count = 0;
        for (const _segment of graphemeSegmenter.segment(countable)) count += 1;
        return count;
    }
    return Array.from(countable).length;
}

export async function updateArticleCharacterCounts({ recentOnly = false, now = new Date(), prisma = new PrismaClient() } = {}) {
    const ownsClient = arguments[0]?.prisma === undefined;
    const cutoff = startOfRecentPeriod(now);
    const records = [];

    try {
        const files = await getPostFiles();
        for (const filePath of files) {
            const info = getArticleInfo(filePath);
            if (!info || (recentOnly && info.articleDate < cutoff)) continue;

            const [source, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
            const { content } = matter(source);
            const characterCount = countArticleCharacters(content);
            records.push({ articleId: info.articleId, characterCount, sourceModifiedAt: stat.mtime });
        }

        if (!recentOnly && records.length === 0) {
            throw new Error(`No valid article files were found under ${BLOG_DIRECTORY}`);
        }

        for (let start = 0; start < records.length; start += 100) {
            const batch = records.slice(start, start + 100);
            await prisma.$transaction(batch.map((record) => prisma.articleCharacterCount.upsert({
                where: { articleId: record.articleId },
                create: { ...record, checkedAt: now },
                update: { ...record, checkedAt: now },
            })));
        }
        if (!recentOnly) {
            const currentIds = new Set(records.map((record) => record.articleId));
            const storedIds = await prisma.articleCharacterCount.findMany({ select: { articleId: true } });
            const staleIds = storedIds
                .map((record) => record.articleId)
                .filter((articleId) => !currentIds.has(articleId));
            for (let start = 0; start < staleIds.length; start += 500) {
                await prisma.articleCharacterCount.deleteMany({
                    where: { articleId: { in: staleIds.slice(start, start + 500) } },
                });
            }
        }
    } finally {
        if (ownsClient) await prisma.$disconnect();
    }

    return records.length;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    const recentOnly = process.argv.includes("--recent");
    updateArticleCharacterCounts({ recentOnly })
        .then((updated) => {
            console.log(`[post-stats] updated ${updated} article(s) (${recentOnly ? "recent month" : "all"})`);
        })
        .catch((error) => {
            console.error("[post-stats] failed", error);
            process.exitCode = 1;
        });
}
