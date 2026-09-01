import { generateTagStaticParams, renderTagPage } from "@/app/tag/[tag]/tag-page-content";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function TagPage({
    params,
}: {
    params: Promise<{ tag: string }>;
}) {
    const { tag: rawTagParam } = await params;
    return renderTagPage(rawTagParam, 1);
}
