import { NextRequest, NextResponse } from "next/server";
import {
    DEV_AUTH_COOKIE_NAME,
    getDevAuthRole,
    isDevAuthMockEnabled,
    normalizeDevAuthRole,
} from "@/lib/dev-auth";
import { readJsonObject, validateMutationRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

function notFound() {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET() {
    if (!isDevAuthMockEnabled()) return notFound();
    return NextResponse.json({ enabled: true, role: await getDevAuthRole() }, {
        headers: { "Cache-Control": "private, no-store" },
    });
}

export async function POST(req: NextRequest) {
    if (!isDevAuthMockEnabled()) return notFound();
    const requestCheck = validateMutationRequest(req);
    if ("error" in requestCheck) {
        return NextResponse.json({ error: requestCheck.error }, { status: requestCheck.status });
    }

    try {
        const body = await readJsonObject(req);
        if (body.role !== "guest" && body.role !== "user" && body.role !== "admin") {
            return NextResponse.json({ error: "Invalid development role" }, { status: 400 });
        }
        const role = normalizeDevAuthRole(body.role);
        const response = NextResponse.json({ ok: true, role });
        response.cookies.set(DEV_AUTH_COOKIE_NAME, role, {
            httpOnly: true,
            sameSite: "strict",
            secure: false,
            path: "/",
            maxAge: 24 * 60 * 60,
        });
        response.headers.set("Cache-Control", "private, no-store");
        return response;
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}
