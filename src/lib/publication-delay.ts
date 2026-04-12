const SITE_TIME_ZONE = "Asia/Tokyo";
const PUBLICATION_DELAY_DAYS = 7;

function formatDateInTimeZone(date: Date, timeZone = SITE_TIME_ZONE): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (!year || !month || !day) {
        throw new Error("Failed to format date in site time zone.");
    }

    return `${year}-${month}-${day}`;
}

function parseDateOnlyString(value: string): { year: number; month: number; day: number } | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }

    return { year, month, day };
}

function toEpochDay(dateOnly: string): number | null {
    const parts = parseDateOnlyString(dateOnly);
    if (!parts) return null;

    return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

function fromEpochDay(epochDay: number): string {
    const date = new Date(epochDay * 86400000);
    return formatDateInTimeZone(date, "UTC");
}

export function getDateOnlyString(value: string | Date | null | undefined): string | null {
    if (!value) return null;

    if (typeof value === "string") {
        const trimmed = value.trim();
        const directMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (directMatch) {
            return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
        }

        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return formatDateInTimeZone(parsed);
        }

        return null;
    }

    if (Number.isNaN(value.getTime())) {
        return null;
    }

    return formatDateInTimeZone(value);
}

export function getTodayDateOnly(now = new Date()): string {
    return getDateOnlyString(now) ?? "2004-09-01";
}

export function addDaysToDateOnly(dateOnly: string, days: number): string | null {
    const epochDay = toEpochDay(dateOnly);
    if (epochDay === null) return null;
    return fromEpochDay(epochDay + days);
}

export function getPublicationDateOnly(articleDate: string | Date | null | undefined): string | null {
    const articleDateOnly = getDateOnlyString(articleDate);
    if (!articleDateOnly) return null;
    return addDaysToDateOnly(articleDateOnly, PUBLICATION_DELAY_DAYS);
}

export function isPostPubliclyVisible(
    articleDate: string | Date | null | undefined,
    now = new Date()
): boolean {
    const articleDateOnly = getDateOnlyString(articleDate);
    const todayDateOnly = getTodayDateOnly(now);
    const articleEpochDay = articleDateOnly ? toEpochDay(articleDateOnly) : null;
    const todayEpochDay = toEpochDay(todayDateOnly);

    if (articleEpochDay === null || todayEpochDay === null) {
        return false;
    }

    return articleEpochDay <= todayEpochDay - PUBLICATION_DELAY_DAYS;
}
