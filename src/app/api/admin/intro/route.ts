import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { newCorrelationHash } from "@/lib/auth-crypto";
import { validateAuthenticatedMutation } from "@/lib/auth-session";
import { readJsonObject } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await validateAuthenticatedMutation(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.session.user.role < 10) return NextResponse.json({ error: "Administrator role required." }, { status: 403 });

    try {
        const body = await readJsonObject(req, 16_384);
        const value = typeof body.value === "string" ? body.value.trim() : "";
        if (!value || Array.from(value).length > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
            return NextResponse.json({ error: "お知らせは1〜1000文字で入力してください。" }, { status: 400 });
        }
        const previous = await prisma.siteSetting.findUnique({ where: { key: "intro_notice" } });
        await prisma.$transaction([
            prisma.siteSetting.upsert({
                where: { key: "intro_notice" },
                create: { key: "intro_notice", value, updatedById: auth.session.user.id },
                update: { value, updatedById: auth.session.user.id },
            }),
            prisma.adminAuditLog.create({
                data: {
                    userId: auth.session.user.id,
                    action: "update",
                    target: "site_setting:intro_notice",
                    beforeValue: previous?.value ?? null,
                    afterValue: value,
                    correlationHash: newCorrelationHash(),
                },
            }),
        ]);
        revalidatePath("/", "page");
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Intro update failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "お知らせを更新できませんでした。" }, { status: 500 });
    }
}
