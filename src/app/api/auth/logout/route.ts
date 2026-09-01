import { NextRequest, NextResponse } from "next/server";
import { revokeCurrentSession, validateAuthenticatedMutation } from "@/lib/auth-session";
import { DEV_AUTH_COOKIE_NAME, isDevAuthMockEnabled } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await validateAuthenticatedMutation(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    await revokeCurrentSession();
    const response = NextResponse.json({ ok: true });
    if (isDevAuthMockEnabled()) {
        response.cookies.set(DEV_AUTH_COOKIE_NAME, "guest", {
            httpOnly: true,
            sameSite: "strict",
            secure: false,
            path: "/",
            maxAge: 24 * 60 * 60,
        });
    }
    return response;
}
