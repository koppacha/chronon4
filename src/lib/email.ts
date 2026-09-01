import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getPublicBaseUrl } from "@/lib/public-base-url";

export class EmailDeliveryUnavailableError extends Error {
    constructor() {
        super("Email delivery is not configured.");
        this.name = "EmailDeliveryUnavailableError";
    }
}

function getEmailBaseUrl(): string {
    try {
        return getPublicBaseUrl();
    } catch {
        throw new EmailDeliveryUnavailableError();
    }
}

async function sendTextEmail(to: string, subject: string, body: string): Promise<void> {
    const region = process.env.AWS_SES_REGION;
    const from = process.env.AWS_SES_FROM;
    if (!region || !from) throw new EmailDeliveryUnavailableError();

    const client = new SESv2Client({ region });
    await client.send(new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
            Simple: {
                Subject: { Data: subject, Charset: "UTF-8" },
                Body: { Text: { Data: body, Charset: "UTF-8" } },
            },
        },
    }));
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = new URL("/api/auth/verify-email", getEmailBaseUrl());
    url.searchParams.set("token", token);
    await sendTextEmail(
        to,
        "Chrononglyph メールアドレス確認",
        `次のURLを30分以内に開いてメール認証を完了してください。\n\n${url.toString()}\n\n心当たりがない場合は、このメールを破棄してください。`,
    );
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const url = new URL("/api/auth/password-reset/exchange", getEmailBaseUrl());
    url.searchParams.set("token", token);
    await sendTextEmail(
        to,
        "Chrononglyph パスワード再設定",
        `次のURLを30分以内に開いてパスワードを再設定してください。\n\n${url.toString()}\n\n心当たりがない場合は、このメールを破棄してください。`,
    );
}

export async function sendPasswordChangedEmail(to: string): Promise<void> {
    await sendTextEmail(to, "Chrononglyph パスワード変更通知", "パスワードが変更されました。心当たりがない場合は管理者へお問い合わせください。");
}

export async function sendAdminLoginEmail(to: string, occurredAt: Date): Promise<void> {
    await sendTextEmail(to, "Chrononglyph 管理者ログイン通知", `管理者アカウントへのログインが成功しました。\n日時: ${occurredAt.toISOString()}`);
}
