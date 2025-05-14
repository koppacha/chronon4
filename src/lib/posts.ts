import { join, relative } from "path";
import fs from "fs/promises";
import { getCache, setCache } from "@/lib/cache";

export const postsDirectory = join(process.cwd(), "blog");

// 除外するフォルダ名
const ignoreFolders = [".obsidian", "keyword"];

/**
 * 再帰的に.mdファイルを探索する
 */
async function getAllMarkdownFiles(directory: string, isRoot = false): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = join(directory, entry.name);

            if (entry.isDirectory()) {
                // 除外フォルダに該当する場合はスキップ
                if (ignoreFolders.includes(entry.name)) {
                    return null;
                }
                // サブディレクトリ内を再帰的に探索
                return await getAllMarkdownFiles(fullPath);
            } else if (entry.isFile() && entry.name.endsWith(".md")) {
                // ルート直下の .md ファイルを無視
                if (isRoot) {
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
    const files = await getAllMarkdownFiles(postsDirectory, true)

    // キャッシュに保存（有効期限1時間: 3600000ms）
    setCache(cacheKey, files, 3600000);

    return files;
}
/**
 * ファイルの内容を取得する
 */
export async function getPostContent(fileName: string): Promise<string> {
    const fullPath = join(postsDirectory, fileName);
    return await fs.readFile(fullPath, "utf8");
}