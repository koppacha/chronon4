import { join, relative } from "path";
import fs from "fs/promises";
import { getCache, setCache } from "@/lib/cache";

export const postsDirectory = join(process.cwd(), "blog");

// 除外するフォルダ名
const ignoreFolders = [".obsidian", "keyword"];
const ALL_POST_FILES_CACHE_TTL_MS = 5 * 60 * 1000;
let allPostFilesInFlight: Promise<string[]> | null = null;

/**
 * 再帰的に.mdファイルを探索する
 */
async function getAllMarkdownFiles(directory: string, depth = 0): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = join(directory, entry.name);

            if (entry.isDirectory()) {
                if (ignoreFolders.includes(entry.name)) {
                    return null;
                }
                if (depth === 0 && !/^\d{4}$/.test(entry.name)) {
                    return null;
                }
                if (depth === 1 && !/^\d{2}$/.test(entry.name)) {
                    return null;
                }
                if (depth >= 2) {
                    return null;
                }
                return await getAllMarkdownFiles(fullPath, depth + 1);
            } else if (entry.isFile() && entry.name.endsWith(".md")) {
                // ルート直下の .md ファイルを無視
                if (depth === 0) {
                    return null;
                }
                // Markdown ファイルの場合、相対パスを取得
                return relative(postsDirectory, fullPath);
            } else {
                return null; // それ以外のファイルは無視
            }
        })
    );
    // 配列を平坦化して返す
    return files.flat().filter(Boolean) as string[];
}

/**
 * 全ての.mdファイルを取得する（キャッシュ対応）
 */
export async function getAllPostFiles(): Promise<string[]> {
    const cacheKey = "allPostFiles";
    const cachedData = getCache<string[]>(cacheKey);

    if (cachedData) {
        return cachedData;
    }
    if (!allPostFilesInFlight) {
        allPostFilesInFlight = getAllMarkdownFiles(postsDirectory)
            .then((files) => {
                setCache(cacheKey, files, ALL_POST_FILES_CACHE_TTL_MS);
                return files;
            })
            .finally(() => {
                allPostFilesInFlight = null;
            });
    }
    return allPostFilesInFlight;
}

/**
 * 認可判定用に、現在のファイル一覧をキャッシュを介さず取得する。
 * 新規記事の追加直後に「最新記事」の境界が古いまま残ることを防ぐ。
 */
export async function getAllPostFilesFresh(): Promise<string[]> {
    return getAllMarkdownFiles(postsDirectory);
}
/**
 * ファイルの内容を取得する
 */
export async function getPostContent(fileName: string): Promise<string> {
    const fullPath = join(postsDirectory, fileName);
    return await fs.readFile(fullPath, "utf8");
}
