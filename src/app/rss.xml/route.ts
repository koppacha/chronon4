import { renderRssXml } from "@/lib/rss";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

const getCachedRssXml = unstable_cache(
    async () => renderRssXml(),
    ["rss-xml"],
    { revalidate: 3600 }
);

export async function GET(): Promise<Response> {
    const xml = await getCachedRssXml();

    return new Response(xml, {
        status: 200,
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
            "X-Robots-Tag": "noindex",
        },
    });
}
