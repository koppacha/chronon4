import { getSiteStatistics } from "@/lib/site-statistics";

const numberFormatter = new Intl.NumberFormat("ja-JP");
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});
const shortDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

export default async function SiteStatisticsHeader() {
    const statistics = await getSiteStatistics().catch((error) => {
        console.error("Failed to load site statistics:", error);
        return null;
    });
    if (!statistics) return null;

    const items = [
        { label: "運営日数", shortLabel: "運営", value: `${numberFormatter.format(statistics.operationDays)}日` },
        { label: "全記事文字数", shortLabel: "総字数", value: `${numberFormatter.format(statistics.totalCharacters)}文字`, shortValue: `${numberFormatter.format(statistics.totalCharacters)}字` },
        { label: "1本あたり平均", shortLabel: "平均", value: `${numberFormatter.format(statistics.averageCharacters)}文字`, shortValue: `${numberFormatter.format(statistics.averageCharacters)}字` },
        {
            label: "最終更新日時",
            shortLabel: "更新",
            value: statistics.latestModifiedAt ? dateTimeFormatter.format(statistics.latestModifiedAt) : "未集計",
            shortValue: statistics.latestModifiedAt ? shortDateTimeFormatter.format(statistics.latestModifiedAt) : "未集計",
        },
    ];

    return (
        <header className="site-statistics" aria-label="サイト統計">
            {items.map(({ label, shortLabel, value, shortValue = value }) => (
                <div className="site-statistics-item" key={label}>
                    <span className="site-statistics-label site-statistics-full">{label}</span>
                    <span className="site-statistics-label site-statistics-short">{shortLabel}</span>
                    <strong className="site-statistics-value site-statistics-full">{value}</strong>
                    <strong className="site-statistics-value site-statistics-short">{shortValue}</strong>
                </div>
            ))}
        </header>
    );
}
