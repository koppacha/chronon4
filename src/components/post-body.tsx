import markdownStyles from "./markdown-styles.module.css";
import { renderPostBodyHtml } from "@/lib/render-post-body";

type Props = {
    category: string;
    content: string;
    date: string;
    fileName?: string;
    sourceMtimeMs?: number;
};

export default async function PostBody({ category, content, date, fileName, sourceMtimeMs }: Props) {
    const dateObj = new Date(date || "2004-09-01T00:00:00.000Z");
    const safeDate = Number.isNaN(dateObj.getTime())
        ? "2004-09-01"
        : dateObj.toISOString().split('T')[0];
    const convertedContent = await renderPostBodyHtml(content, safeDate, {
        fileName,
        sourceMtimeMs,
    });
    const categoryStyle = (category === "独り言") ? "category-monologue" : "category-today";

    return (
        <div className={`content-body ${categoryStyle}`}>
            <div
                className={markdownStyles["markdown"]}
                dangerouslySetInnerHTML={{ __html: convertedContent }}
            />
        </div>
    );
}
