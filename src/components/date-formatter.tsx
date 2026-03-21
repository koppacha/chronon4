import Link from "next/link";

type Props = {
  dateString: string;
};

function parseDateParts(dateString: string) {
  const raw = String(dateString ?? "").trim();
  const matched = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);

  if (matched) {
    return {
      year: matched[1],
      month: matched[2],
      day: matched[3],
      dateTime: `${matched[1]}-${matched[2]}-${matched[3]}`,
    };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return {
      year: "0000",
      month: "00",
      day: "00",
      dateTime: raw,
    };
  }

  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    day: String(date.getUTCDate()).padStart(2, "0"),
    dateTime: date.toISOString().split("T")[0],
  };
}

const DateFormatter = ({ dateString }: Props) => {
  const { year, month, day, dateTime } = parseDateParts(dateString);

  return (
    <Link href={`/date/${year}/${month}`}>
      <time dateTime={dateTime} className="tag-block">{`${year}/${month}/${day}`}</time>
    </Link>
  );
};

export default DateFormatter;
