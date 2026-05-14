import { generateTagStaticParams, renderTagPage } from "@/app/tag/[tag]/tag-page-content";

export const revalidate = 604800;
export const dynamicParams = false;

export async function generateStaticParams() {
    return generateTagStaticParams();
}

export default async function TagPage({
    params,
}: {
    params: Promise<{ tag: string }>;
}) {
    const { tag: rawTagParam } = await params;
    return renderTagPage(rawTagParam, 1);
}
