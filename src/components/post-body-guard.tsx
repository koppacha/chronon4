import PostBody from "@/components/post-body";
import { shouldHidePostBody } from "@/lib/post-visibility";

type Props = {
    idOrSlug: string | number;
    tags?: unknown;
    category: string | string[];
    content: string;
    date: string;
};

export default function PostBodyGuard({ idOrSlug, tags, category, content, date }: Props) {
    if (shouldHidePostBody(idOrSlug, tags)) {
        return <div>この記事は非公開に設定されています</div>;
    }

    const normalizedCategory = Array.isArray(category) ? (category[0] || "") : (category || "");

    return <PostBody category={normalizedCategory} content={content} date={date} />;
}
