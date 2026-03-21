import { NextResponse } from "next/server";
import { getRecentPostsData } from "@/lib/recent-posts";

export async function GET(req: Request) {

    try {
        const { searchParams } = new URL(req.url);
        const nParam = searchParams.get("n");
        const mParam = searchParams.get("m");
        const aParam = searchParams.get("a");
        const fParam = searchParams.get("f");

        const n = nParam && /^\d+$/.test(nParam) ? Number.parseInt(nParam, 10) : 10;
        const m = mParam && /^\d+$/.test(mParam) ? Number.parseInt(mParam, 10) : 0;
        const a = aParam && /^\d+$/.test(aParam) ? Number.parseInt(aParam, 10) : null;
        const filteredPosts = await getRecentPostsData({ n, m, a, f: fParam });

        return NextResponse.json(filteredPosts, {
            status: 200,
            headers: {
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
