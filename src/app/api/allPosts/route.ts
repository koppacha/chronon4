import { NextResponse } from "next/server";
import { getVisibleArchivePostMeta } from "@/lib/archive";

export async function GET() {
    try {
        const posts = await getVisibleArchivePostMeta();
        return NextResponse.json(posts.map(({ idString, title, date, tags, categories }) => ({ id: idString, title, date, tags, categories })), {
            status: 200,
            headers: { "Cache-Control": "public, max-age=60" },
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
