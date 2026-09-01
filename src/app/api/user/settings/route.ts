import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth-crypto";
import { revokeCurrentSession, validateAuthenticatedMutation } from "@/lib/auth-session";
import { readJsonObject } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const auth = await validateAuthenticatedMutation(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    try {
        const body = await readJsonObject(req);
        const handleName = typeof body.handleName === "string" ? body.handleName.trim() : "";
        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
        const confirm = typeof body.confirm === "string" ? body.confirm : "";
        if (Array.from(handleName).length > 40 || /[\u0000-\u001F\u007F]/.test(handleName)) {
            return NextResponse.json({ error: "ハンドルネームは40文字以内で入力してください。" }, { status: 400 });
        }

        const data: { handleName: string | null; passwordHash?: string } = { handleName: handleName || null };
        let passwordChanged = false;
        if (newPassword || confirm || currentPassword) {
            const error = validatePassword(newPassword);
            if (error || newPassword !== confirm) return NextResponse.json({ error: error ?? "新しいパスワードが一致しません。" }, { status: 400 });
            const user = await prisma.user.findUnique({ where: { id: auth.session.user.id } });
            if (!user || !await verifyPassword(currentPassword, user.passwordHash)) {
                return NextResponse.json({ error: "現在のパスワードが正しくありません。" }, { status: 403 });
            }
            data.passwordHash = await hashPassword(newPassword);
            passwordChanged = true;
        }

        if (passwordChanged) {
            await prisma.$transaction([
                prisma.user.update({ where: { id: auth.session.user.id }, data }),
                prisma.session.updateMany({
                    where: { userId: auth.session.user.id, revokedAt: null },
                    data: { revokedAt: new Date() },
                }),
            ]);
            await revokeCurrentSession();
        } else {
            await prisma.user.update({ where: { id: auth.session.user.id }, data });
        }
        return NextResponse.json({ ok: true, passwordChanged });
    } catch (error) {
        console.error("User settings update failed.", error instanceof Error ? error.name : "UnknownError");
        return NextResponse.json({ error: "設定を更新できませんでした。" }, { status: 500 });
    }
}
