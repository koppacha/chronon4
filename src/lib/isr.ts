export const ONE_DAY_SECONDS = 24 * 60 * 60;
export const ONE_WEEK_SECONDS = 7 * ONE_DAY_SECONDS;
export const FIVE_MINUTES_SECONDS = 5 * 60;

export const HOME_REVALIDATE_HOUR_JST = 0;
export const HOME_REVALIDATE_MINUTE_JST = 5;
export const HOME_REVALIDATE_WINDOW_MINUTES = 10;

type JstDateParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
};

function getJstDateParts(now: Date): JstDateParts {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });

    const parts = formatter.formatToParts(now);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

    return {
        year: get("year"),
        month: get("month"),
        day: get("day"),
        hour: get("hour"),
        minute: get("minute"),
    };
}

function formatJstDateTime(parts: JstDateParts): string {
    return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} JST`;
}

export function getHomeRevalidateTimingStatus(now = new Date()) {
    const jst = getJstDateParts(now);
    const currentMinutes = jst.hour * 60 + jst.minute;
    const targetMinutes = HOME_REVALIDATE_HOUR_JST * 60 + HOME_REVALIDATE_MINUTE_JST;
    const minutesFromRecommended = currentMinutes - targetMinutes;

    return {
        nowJst: formatJstDateTime(jst),
        recommendedTimeJst: `${String(HOME_REVALIDATE_HOUR_JST).padStart(2, "0")}:${String(HOME_REVALIDATE_MINUTE_JST).padStart(2, "0")} JST`,
        windowMinutes: HOME_REVALIDATE_WINDOW_MINUTES,
        minutesFromRecommended,
        inRecommendedWindow: Math.abs(minutesFromRecommended) <= HOME_REVALIDATE_WINDOW_MINUTES,
    };
}
