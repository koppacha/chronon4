import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRecentPostsData } from "@/lib/recent-posts";
import { getCurrentSession } from "@/lib/auth-session";
import { isValidAnonymousSessionId } from "@/lib/anonymous-session";

export const dynamic = "force-dynamic";

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
        const session = await getCurrentSession();
        const anonymousId = (await cookies()).get("access_id")?.value;
        const viewerReadActor = session
            ? { type: "user" as const, id: String(session.user.id) }
            : isValidAnonymousSessionId(anonymousId)
                ? { type: "anonymous" as const, id: anonymousId }
                : undefined;
        const filteredPosts = await getRecentPostsData({
            n,
            m,
            a,
            f: fParam,
            viewerRole: session?.user.role ?? 0,
            viewerReadActor,
        });

        return NextResponse.json(filteredPosts, {
            status: 200,
            headers: {
                "Cache-Control": session ? "private, no-store" : "public, max-age=0, must-revalidate",
            },
        });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}
