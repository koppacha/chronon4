import { renderRssXml } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
    // RSSには失効可能な本文抜粋が含まれるため、公開可否を要求ごとに再評価する。
    const xml = await renderRssXml();

    return new Response(xml, {
        status: 200,
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=0, must-revalidate",
            "X-Robots-Tag": "noindex",
        },
    });
}
