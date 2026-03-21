import { NextRequest, NextResponse } from "next/server";
import { getAllArchivePostMeta } from "@/lib/archive";

export async function GET(request: NextRequest) {
    try {
        const ids = request.nextUrl.searchParams
            .getAll("id")
            .map((value) => value.trim())
            .filter((value) => /^\d{5}$/.test(value));

        if (ids.length === 0) {
            return NextResponse.json({}, { status: 200 });
        }

        const uniqueIds = Array.from(new Set(ids));
        const allMeta = await getAllArchivePostMeta();
        const metaMap = Object.fromEntries(
            allMeta
                .filter((post) => uniqueIds.includes(post.idString))
                .map((post) => [post.idString, post.date])
        );

        return NextResponse.json(metaMap, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
