import "server-only";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { encryptEmail } from "@/lib/auth-crypto";
import { isDevAuthMockEnabledForEnvironment } from "@/lib/dev-auth-config";

export const DEV_AUTH_COOKIE_NAME = "chronon_dev_auth_role";
export const DEV_AUTH_SESSION_ID = -1;
const DEV_DUMMY_EMAIL_HMAC = "development-only-dummy-user";
type DevDummyUser = Awaited<ReturnType<typeof createOrLoadDevDummyUser>>;
let dummyUserPromise: Promise<DevDummyUser> | null = null;

export type DevAuthRole = "guest" | "user" | "admin";

export function isDevAuthMockEnabled(): boolean {
    return isDevAuthMockEnabledForEnvironment(process.env.NODE_ENV, process.env.ENABLE_DEV_AUTH_MOCK);
}

export function normalizeDevAuthRole(value: unknown): DevAuthRole {
    return value === "guest" || value === "admin" ? value : "user";
}

export function devAuthRoleNumber(role: DevAuthRole): number {
    if (role === "admin") return 10;
    if (role === "user") return 1;
    return 0;
}

export async function getDevAuthRole(): Promise<DevAuthRole> {
    if (!isDevAuthMockEnabled()) return "guest";
    const store = await cookies();
    return normalizeDevAuthRole(store.get(DEV_AUTH_COOKIE_NAME)?.value);
}

function createOrLoadDevDummyUser() {
    const encrypted = encryptEmail("dummy-user@localhost.invalid");
    return prisma.user.upsert({
        where: { emailHmac: DEV_DUMMY_EMAIL_HMAC },
        create: {
            emailEncrypted: encrypted.encrypted,
            emailHmac: DEV_DUMMY_EMAIL_HMAC,
            passwordHash: "development-only-dummy-password",
            verifiedAt: new Date(),
            handleName: "開発用ダミー",
            role: 1,
        },
        update: {},
    });
}

export async function getOrCreateDevDummyUser() {
    if (!dummyUserPromise) {
        dummyUserPromise = createOrLoadDevDummyUser().catch((error) => {
            dummyUserPromise = null;
            throw error;
        });
    }
    return dummyUserPromise;
}
