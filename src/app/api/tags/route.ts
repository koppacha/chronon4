import { NextResponse } from "next/server";
import { getTopTagStats } from "@/lib/tag-stats";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const nParam = searchParams.get("n");
        const n = nParam === null ? 20 : (/^\d+$/.test(nParam) ? Number.parseInt(nParam, 10) : NaN);

        if (!Number.isFinite(n) || n < 0) {
            return NextResponse.json({ error: "n must be an integer greater than or equal to 0" }, { status: 400 });
        }

        const tags = await getTopTagStats(n);
        return NextResponse.json(tags, {
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
