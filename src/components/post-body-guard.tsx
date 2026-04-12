import PostBody from "@/components/post-body";
import { shouldHidePostBody } from "@/lib/post-visibility";

type Props = {
    idOrSlug: string | number;
    tags?: unknown;
    category: string | string[];
    content: string;
    date: string;
    fileName?: string;
    sourceMtimeMs?: number;
};

export default async function PostBodyGuard({ idOrSlug, tags, category, content, date, fileName, sourceMtimeMs }: Props) {
    if (shouldHidePostBody(idOrSlug, tags)) {
        return <div>この記事は非公開に設定されています</div>;
    }

    const normalizedCategory = Array.isArray(category) ? (category[0] || "") : (category || "");

    return (
        <PostBody
            category={normalizedCategory}
            content={content}
            date={date}
            fileName={fileName}
            sourceMtimeMs={sourceMtimeMs}
        />
    );
}
