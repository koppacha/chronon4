/*
 * 汎用スクリプト置き場
 */

// YYYY/MM/YYYY-MM-DD-NNNNN.md 形式を分解する
export const id2slug = (str: string) => {
    const [,,year, month, day, postId,] = String(str).split(/[/\-.]/)
    return {year, month, day, postId}
}

// 更新日時を yyyy/mm/dd HH:MM:SS 形式で整形
export const formatDate = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};