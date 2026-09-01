import { NextRequest, NextResponse } from "next/server";
import { getHomeRevalidateTimingStatus } from "@/lib/isr";
import { revalidateSiteContent } from "@/lib/site-revalidation";

export const dynamic = "force-dynamic";

function hasValidSecret(req: NextRequest): boolean {
    const expected = process.env.REVALIDATE_SECRET;
    if (!expected) return false;

    const headerSecret = req.headers.get("x-revalidate-secret");

    return headerSecret === expected;
}

export async function POST(req: NextRequest) {
    if (!hasValidSecret(req)) {
        return NextResponse.json({ revalidated: false, error: "Invalid revalidate secret." }, { status: 401 });
    }

    const target = req.nextUrl.searchParams.get("target") ?? "home";
    const strictWindow = req.nextUrl.searchParams.get("strictWindow") === "1";
    const timing = getHomeRevalidateTimingStatus();

    if (target !== "home") {
        return NextResponse.json(
            { revalidated: false, error: "Unsupported revalidate target.", supportedTargets: ["home"] },
            { status: 400 }
        );
    }

    if (strictWindow && !timing.inRecommendedWindow) {
        return NextResponse.json(
            {
                revalidated: false,
                error: "Outside the recommended home revalidate window.",
                timing,
            },
            { status: 409 }
        );
    }

    const paths = revalidateSiteContent();

    return NextResponse.json({
        revalidated: true,
        target,
        paths,
        timing,
    });
}

export async function GET(req: NextRequest) {
    if (!hasValidSecret(req)) {
        return NextResponse.json({ revalidated: false, error: "Invalid revalidate secret." }, { status: 401 });
    }

    return NextResponse.json({
        revalidated: false,
        target: "home",
        timing: getHomeRevalidateTimingStatus(),
        usage: "POST /api/revalidate?target=home",
    });
}
