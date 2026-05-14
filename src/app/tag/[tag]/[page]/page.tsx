import { notFound, redirect } from "next/navigation";
import {
    generateTagPageStaticParams,
    normalizeTagUrlKey,
    parseTagPageParam,
    renderTagPage,
} from "@/app/tag/[tag]/tag-page-content";

export const revalidate = 604800;
export const dynamicParams = false;

export async function generateStaticParams() {
    return generateTagPageStaticParams();
}

export default async function TagPagedPage({
    params,
}: {
    params: Promise<{ tag: string; page: string }>;
}) {
    const { tag: rawTagParam, page: rawPageParam } = await params;
    const page = parseTagPageParam(rawPageParam);

    if (page === 1) {
        redirect(`/tag/${encodeURIComponent(normalizeTagUrlKey(rawTagParam))}`);
    }

    if (page === null) notFound();

    return renderTagPage(rawTagParam, page);
}
