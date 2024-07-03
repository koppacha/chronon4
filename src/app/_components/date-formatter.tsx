import { parseISO, format } from "date-fns";

type Props = {
  dateString: string;
};

const DateFormatter = ({ dateString }: Props) => {

  // 投稿日情報は過去記事の形式によってObjectとStringが混在しているため、両方のパターンに対応
  const date = (typeof dateString === "object") ? dateString : parseISO(dateString)
  return <time dateTime={dateString}>{format(date, "yyyy/MM/dd")}</time>;
};

export default DateFormatter;
