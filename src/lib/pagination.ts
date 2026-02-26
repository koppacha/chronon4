export const LIST_PAGE_SIZE = 10;

export function parsePageParam(pageParam: string | string[] | undefined): number | null {
    if (pageParam === undefined) return 1;
    if (Array.isArray(pageParam)) return null;
    if (!/^[1-9]\d*$/.test(pageParam)) return null;
    return Number(pageParam);
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (page < 1 || page > totalPages) {
        return null;
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
        items: items.slice(start, end),
        page,
        pageSize,
        totalItems,
        totalPages,
    };
}
