type Props = {
  dateString: string;
};

const DateFormatter = ({ dateString }: Props) => {

  // 投稿日情報は過去記事の形式によってObjectとStringが混在しているため、両方のパターンに対応
  const date = new Date(dateString)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return <time dateTime={dateString} className="tag-block">{`${year}/${month}/${day}`}</time>;
};

export default DateFormatter;
