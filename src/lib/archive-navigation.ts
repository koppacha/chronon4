export const ARCHIVE_FIRST_YEAR = 2004;
export const GENERAL_USER_FIRST_ARCHIVE_YEAR = 2023;

export function canViewArchiveHeader(viewerRole: number): boolean {
    return viewerRole >= 1;
}

export function canSelectArchiveYear(year: number, viewerRole: number): boolean {
    if (!canViewArchiveHeader(viewerRole)) return false;
    return viewerRole >= 10 || year >= GENERAL_USER_FIRST_ARCHIVE_YEAR;
}

export function selectCenteredWindow<T>(items: T[], currentIndex: number, size = 51, before = 25): T[] {
    if (currentIndex < 0 || currentIndex >= items.length || size < 1) return [];
    const windowSize = Math.min(size, items.length);
    const preferredStart = currentIndex - before;
    const start = Math.max(0, Math.min(preferredStart, items.length - windowSize));
    return items.slice(start, start + windowSize);
}
