/*
 * 汎用スクリプト置き場
 */

// YYYY/MM/YYYY-MM-DD-NNNNN.md 形式を分解する
export const id2slug = (str: string) => {
    const [,,year, month, day, postId,] = String(str).split(/[/\-.]/)
    return {year, month, day, postId}
}
