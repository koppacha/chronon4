import Link from "next/link";
import { Grid } from "@mui/system";
import { getYearColorHexByYear } from "@/lib/year-color";

type Props = {
    title: string;
    activeYear: number;
    activeMonth?: number;
    showTitle?: boolean;
};

export default function DateArchiveHeader({ title, activeYear, activeMonth, showTitle = true }: Props) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const years = Array.from({ length: currentYear - 2004 + 1 }, (_, i) => 2004 + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const activeYearColor = getYearColorHexByYear(activeYear);

    return (
        <div className="archive-header" style={{ width: "100%" }}>
            {showTitle && <h1 className="archive-title">{title}</h1>}

            <Grid
                container
                columns={{ xs: 10, md: years.length }}
                columnSpacing={0.25}
                rowSpacing={0.25}
                className="archive-nav-grid"
                sx={{ width: "100%", marginBottom: "8px" }}
            >
                {years.map((year) => {
                    const isDisabledYear = year <= 2022;
                    const className = `archive-nav-button${year === activeYear ? " is-active" : ""}${isDisabledYear ? " is-disabled" : ""}`;
                    const activeStyle = year === activeYear
                        ? {
                            backgroundColor: getYearColorHexByYear(year) ?? undefined,
                            borderColor: getYearColorHexByYear(year) ?? undefined,
                            color: "#2c2c2c",
                        }
                        : undefined;

                    return (
                        <Grid key={year} size={1}>
                            {isDisabledYear ? (
                                <span className={className} aria-disabled="true" style={activeStyle}>
                                    {year}
                                </span>
                            ) : (
                                <Link href={`/date/${year}`} className={className} style={activeStyle}>
                                    {year}
                                </Link>
                            )}
                        </Grid>
                    );
                })}
            </Grid>

            <Grid
                container
                columns={12}
                columnSpacing={0.25}
                rowSpacing={0.25}
                className="archive-nav-grid"
                sx={{ width: "100%" }}
            >
                {months.map((month) => {
                    const isFutureMonth = activeYear === currentYear && month > currentMonth;
                    const className = `archive-nav-button${month === activeMonth ? " is-active" : ""}${isFutureMonth ? " is-disabled" : ""}`;
                    const activeStyle = month === activeMonth
                        ? {
                            backgroundColor: activeYearColor ?? undefined,
                            borderColor: activeYearColor ?? undefined,
                            color: "#2c2c2c",
                        }
                        : undefined;

                    return (
                        <Grid key={month} size={1}>
                            {isFutureMonth ? (
                                <span className={className} aria-disabled="true" style={activeStyle}>
                                    {String(month).padStart(2, "0")}
                                </span>
                            ) : (
                                <Link
                                    href={`/date/${activeYear}/${String(month).padStart(2, "0")}`}
                                    className={className}
                                    style={activeStyle}
                                >
                                    {String(month).padStart(2, "0")}
                                </Link>
                            )}
                        </Grid>
                    );
                })}
            </Grid>
        </div>
    );
}
