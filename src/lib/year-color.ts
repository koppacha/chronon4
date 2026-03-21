const MIN_YEAR = 2000;

export const DEFAULT_YEAR_COLOR_CLASS = "year-color-default";
export const YEAR_COLOR_HEX: Record<number, string> = {
    2026: "#E4E650",
    2025: "#A550E6",
    2024: "#50E687",
    2023: "#E6B750",
    2022: "#E67150",
    2021: "#50E6AA",
    2020: "#AAAAAA",
    2019: "#F26DA0",
    2018: "#6DF27B",
    2017: "#F26DEE",
    2016: "#F2EF6D",
    2015: "#A76DF2",
    2014: "#F2AE6D",
    2013: "#7EF26D",
    2012: "#F26F6D",
    2011: "#6DB4F2",
    2010: "#CCCCCC",
    2009: "#FA8B89",
    2008: "#DB89FA",
    2007: "#FAF889",
    2006: "#B789FA",
    2005: "#89A4FA",
    2004: "#CEFA89",
    2003: "#FAC989",
    2002: "#8DFA89",
    2001: "#89F6FA",
    2000: "#FFFFFF",
};

function normalizeDate(dateValue?: string | null): Date | null {
    if (!dateValue) return null;

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;

    return date;
}

export function getYearColorClass(dateValue?: string | null, now = new Date()): string {
    const date = normalizeDate(dateValue);
    if (!date) return DEFAULT_YEAR_COLOR_CLASS;

    if (date > now) return DEFAULT_YEAR_COLOR_CLASS;

    const year = date.getFullYear();
    if (year < MIN_YEAR || year > now.getFullYear()) {
        return DEFAULT_YEAR_COLOR_CLASS;
    }

    return `y${year}`;
}

export function getYearColorHexByYear(year?: number | null): string | null {
    if (!year) return null;
    return YEAR_COLOR_HEX[year] ?? null;
}

export function getYearColorHex(dateValue?: string | null, now = new Date()): string | null {
    const date = normalizeDate(dateValue);
    if (!date) return null;

    if (date > now) return null;

    const year = date.getFullYear();
    if (year < MIN_YEAR || year > now.getFullYear()) {
        return null;
    }

    return getYearColorHexByYear(year);
}

export function isExternalHref(href?: string | null): boolean {
    if (!href) return false;
    return /^(https?:)?\/\//i.test(href);
}

export function isInternalPostHref(href?: string | null): boolean {
    if (!href) return false;
    return /^\/post\/\d{5}$/.test(href);
}

export function getPostIdFromHref(href?: string | null): string | null {
    if (!isInternalPostHref(href)) return null;

    return href!.match(/^\/post\/(\d{5})$/)?.[1] ?? null;
}
