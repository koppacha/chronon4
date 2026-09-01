import PostBody from "@/components/post-body";

type Props = {
    canViewBody: boolean;
    category: string | string[];
    content: string | null;
    date: string;
    fileName?: string;
    sourceMtimeMs?: number;
};

export default async function PostBodyGuard({ canViewBody, category, content, date, fileName, sourceMtimeMs }: Props) {
    if (!canViewBody || content === null) {
        return <div>この記事は非公開に設定されています</div>;
    }

    const normalizedCategory = Array.isArray(category) ? (category[0] || "") : (category || "");
    return <PostBody category={normalizedCategory} content={content} date={date} fileName={fileName} sourceMtimeMs={sourceMtimeMs} />;
}
