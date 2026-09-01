import { NextResponse } from "next/server";
import { getSessionSummary } from "@/lib/session-summary";

export const dynamic = "force-dynamic";

export async function GET() {
    const summary = await getSessionSummary();
    return NextResponse.json(summary, {
        status: summary.unavailable ? 503 : 200,
        headers: { "Cache-Control": "private, no-store" },
    });
}
