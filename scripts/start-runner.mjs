import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn as spawnProcess } from "node:child_process";

const REVALIDATE_HOUR_JST = 4;
const REVALIDATE_MINUTE_JST = 0;
const POST_STATS_HOUR_JST = 5;
const POST_STATS_MINUTE_JST = 0;
const REVALIDATE_WINDOW_MINUTES = 10;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PORT = "3004";
const MARKER_DIRECTORY = path.join(os.tmpdir(), "chronon4-revalidate");
const BLOG_DIRECTORY = process.env.BLOG_DIRECTORY || path.join(process.cwd(), "blog");
const AUTH_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function databaseFilePath() {
    const url = process.env.DATABASE_URL || "";
    if (!url.startsWith("file:")) return null;
    const rawPath = url.slice("file:".length);
    if (!rawPath) return null;
    return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), "prisma", rawPath);
}

async function ensureDatabasePermissions() {
    const databasePath = databaseFilePath();
    if (!databasePath) return;
    const backupDirectory = process.env.DATABASE_BACKUP_DIRECTORY || path.join(path.dirname(databasePath), "backups");
    await fs.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    await fs.chmod(backupDirectory, 0o700);
    await fs.chmod(databasePath, 0o600);
}

function getRuntimeIdentity() {
    if (typeof process.getuid !== "function" || process.getuid() !== 0) return null;
    const uid = Number(process.env.APP_UID || "1000");
    const gid = Number(process.env.APP_GID || "1000");
    if (!Number.isSafeInteger(uid) || uid <= 0 || !Number.isSafeInteger(gid) || gid <= 0) {
        throw new Error("APP_UID and APP_GID must be positive integers.");
    }
    return { uid, gid };
}

async function prepareRuntimeOwnership(identity) {
    const databasePath = databaseFilePath();
    if (!databasePath) return;
    const backupDirectory = process.env.DATABASE_BACKUP_DIRECTORY || path.join(path.dirname(databasePath), "backups");
    await fs.chown(path.dirname(databasePath), identity.uid, identity.gid);
    await fs.chown(databasePath, identity.uid, identity.gid);
    await fs.chown(backupDirectory, identity.uid, identity.gid);
    const entries = await fs.readdir(backupDirectory, { withFileTypes: true });
    await Promise.all(entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".db"))
        .map((entry) => fs.chown(path.join(backupDirectory, entry.name), identity.uid, identity.gid)));
}

async function backupDatabase() {
    const databasePath = databaseFilePath();
    if (!databasePath) return;
    try {
        await fs.access(databasePath);
    } catch {
        return;
    }
    const backupDirectory = process.env.DATABASE_BACKUP_DIRECTORY || path.join(path.dirname(databasePath), "backups");
    await fs.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    await fs.chmod(backupDirectory, 0o700);
    await fs.chmod(databasePath, 0o600);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDirectory, `before-migrate-${stamp}.db`);
    await fs.copyFile(databasePath, backupPath);
    await fs.chmod(backupPath, 0o600);
}

async function runPrismaMigrations() {
    await backupDatabase();
    const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
    await new Promise((resolve, reject) => {
        const migration = spawnProcess(prismaBin, ["migrate", "deploy"], { stdio: "inherit", env: process.env });
        migration.on("error", reject);
        migration.on("exit", (code) => code === 0 ? resolve(undefined) : reject(new Error(`prisma migrate deploy exited with ${code}`)));
    });
    await ensureDatabasePermissions();
}

async function cleanupExpiredAuthData() {
    const { PrismaClient } = await import("@prisma/client");
    const client = new PrismaClient();
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    try {
        await client.$transaction([
            client.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
            client.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
            client.session.deleteMany({
                where: {
                    OR: [
                        { expiresAt: { lt: thirtyDaysAgo } },
                        { revokedAt: { lt: thirtyDaysAgo } },
                    ],
                },
            }),
            client.authAttempt.deleteMany({ where: { createdAt: { lt: ninetyDaysAgo } } }),
            client.rateLimitBucket.deleteMany({ where: { updatedAt: { lt: ninetyDaysAgo } } }),
            client.user.deleteMany({ where: { verifiedAt: null, signedUpAt: { lt: oneDayAgo } } }),
        ]);
    } finally {
        await client.$disconnect();
    }
}

function getServerPort() {
    return process.env.PORT || DEFAULT_PORT;
}

async function assertReadableDirectory(directory, label) {
    let stat;

    try {
        stat = await fs.stat(directory);
    } catch (error) {
        throw new Error(`${label} is not mounted or cannot be accessed: ${directory}`, { cause: error });
    }

    if (!stat.isDirectory()) {
        throw new Error(`${label} is not a directory: ${directory}`);
    }

    try {
        await fs.access(directory);
    } catch (error) {
        throw new Error(`${label} is not readable: ${directory}`, { cause: error });
    }
}

async function hasBlogDirectoryShape(directory) {
    const yearEntries = await fs.readdir(directory, { withFileTypes: true });
    const yearDirectories = yearEntries
        .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
        .map((entry) => entry.name);

    for (const year of yearDirectories) {
        const yearPath = path.join(directory, year);
        const monthEntries = await fs.readdir(yearPath, { withFileTypes: true });
        if (monthEntries.some((entry) => entry.isDirectory() && /^\d{2}$/.test(entry.name))) {
            return true;
        }
    }

    return false;
}

async function runStartupChecks() {
    const required = [
        "NEXT_PUBLIC_BASE_URL",
        "BUILD_NEXT_PUBLIC_BASE_URL",
        "EMAIL_ENCRYPTION_KEY",
        "EMAIL_HMAC_KEY",
        "IP_HMAC_KEY",
        "TOKEN_HMAC_KEY",
        "SESSION_HMAC_KEY",
        "AWS_SES_REGION",
        "AWS_SES_FROM",
    ];
    if (process.env.REVALIDATE_SCHEDULER_ENABLED !== "0") {
        required.push("REVALIDATE_SECRET");
    }
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Required production configuration is missing: ${missing.join(", ")}`);
    }
    const baseUrl = new URL(process.env.NEXT_PUBLIC_BASE_URL);
    if (baseUrl.protocol !== "https:") {
        throw new Error("NEXT_PUBLIC_BASE_URL must use HTTPS in production.");
    }
    const buildBaseUrl = new URL(process.env.BUILD_NEXT_PUBLIC_BASE_URL);
    if (buildBaseUrl.origin !== baseUrl.origin) {
        throw new Error("NEXT_PUBLIC_BASE_URL must match the origin embedded in the production build.");
    }
    if (Buffer.from(process.env.EMAIL_ENCRYPTION_KEY, "base64").length !== 32) {
        throw new Error("EMAIL_ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }
    for (const name of ["EMAIL_HMAC_KEY", "IP_HMAC_KEY", "TOKEN_HMAC_KEY", "SESSION_HMAC_KEY"]) {
        const value = process.env[name];
        const bytes = value.startsWith("base64:")
            ? Buffer.from(value.slice("base64:".length), "base64")
            : Buffer.from(value, "utf8");
        if (bytes.length < 32) {
            throw new Error(`${name} must contain at least 32 bytes.`);
        }
    }

    if (process.env.BLOG_MOUNT_CHECK_ENABLED === "0") {
        console.warn("[startup-check] BLOG_MOUNT_CHECK_ENABLED=0; blog mount check is skipped.");
        return;
    }

    await assertReadableDirectory(BLOG_DIRECTORY, "Blog directory");

    if (!(await hasBlogDirectoryShape(BLOG_DIRECTORY))) {
        throw new Error(
            `Blog directory does not look like a mounted blog tree: ${BLOG_DIRECTORY}. ` +
            "Expected at least one yyyy/mm directory."
        );
    }

    console.log(`[startup-check] blog directory is mounted: ${BLOG_DIRECTORY}`);
}

/** @type {import("node:child_process").SpawnOptions} */
const serverOptions = {
    stdio: "inherit",
    env: {
        ...process.env,
        PORT: getServerPort(),
    },
};

if (process.env.PRISMA_MIGRATE_ON_START !== "0") {
    await runPrismaMigrations().catch((error) => {
        console.error("[startup-migration] failed:", error);
        process.exit(1);
    });
} else {
    console.warn("[startup-migration] skipped because PRISMA_MIGRATE_ON_START=0");
}

await cleanupExpiredAuthData().catch((error) => {
    console.error("[auth-cleanup] startup cleanup failed:", error);
});

await runStartupChecks().catch((error) => {
    console.error("[startup-check] failed:", error);
    process.exit(1);
});

const runtimeIdentity = getRuntimeIdentity();
if (runtimeIdentity) {
    await prepareRuntimeOwnership(runtimeIdentity).catch((error) => {
        console.error("[runtime-user] failed:", error);
        process.exit(1);
    });
    Object.assign(serverOptions, runtimeIdentity);
}

const server = spawn(process.execPath, ["server.js"], serverOptions);

server.on("exit", (code, signal) => {
    console.log(`[revalidate-scheduler] next server exited: code=${code ?? "null"} signal=${signal ?? "null"}`);
    process.exit(code ?? 1);
});

/** @type {NodeJS.Signals[]} */
const shutdownSignals = ["SIGINT", "SIGTERM"];

for (const signal of shutdownSignals) {
    process.on(signal, () => {
        server.kill(signal);
    });
}

function getJstParts(now = new Date()) {
    const jst = new Date(now.getTime() + JST_OFFSET_MS);
    return {
        year: jst.getUTCFullYear(),
        month: jst.getUTCMonth(),
        day: jst.getUTCDate(),
        hour: jst.getUTCHours(),
        minute: jst.getUTCMinutes(),
    };
}

function getJstDateKey(now = new Date()) {
    const parts = getJstParts(now);
    return [
        String(parts.year).padStart(4, "0"),
        String(parts.month + 1).padStart(2, "0"),
        String(parts.day).padStart(2, "0"),
    ].join("-");
}

function getJstScheduleUtcMs(parts, hour, minute) {
    return Date.UTC(
        parts.year,
        parts.month,
        parts.day,
        hour,
        minute
    ) - JST_OFFSET_MS;
}

function getJstTargetUtcMs(parts) {
    return getJstScheduleUtcMs(parts, REVALIDATE_HOUR_JST, REVALIDATE_MINUTE_JST);
}

function hasTodayTargetPassed(now = new Date()) {
    const parts = getJstParts(now);
    return now.getTime() >= getJstTargetUtcMs(parts);
}

function getNextRevalidateDelayMs(now = new Date()) {
    const parts = getJstParts(now);
    let targetUtcMs = getJstTargetUtcMs(parts);

    if (targetUtcMs <= now.getTime()) {
        targetUtcMs += ONE_DAY_MS;
    }

    return targetUtcMs - now.getTime();
}

function getNextPostStatsDelayMs(now = new Date()) {
    const parts = getJstParts(now);
    let targetUtcMs = getJstScheduleUtcMs(parts, POST_STATS_HOUR_JST, POST_STATS_MINUTE_JST);
    if (targetUtcMs <= now.getTime()) targetUtcMs += ONE_DAY_MS;
    return targetUtcMs - now.getTime();
}

function isInStartupWindow(now = new Date()) {
    const parts = getJstParts(now);
    const currentMinutes = parts.hour * 60 + parts.minute;
    const targetMinutes = REVALIDATE_HOUR_JST * 60 + REVALIDATE_MINUTE_JST;
    return Math.abs(currentMinutes - targetMinutes) <= REVALIDATE_WINDOW_MINUTES;
}

async function triggerHomeRevalidate(reason) {
    const secret = process.env.REVALIDATE_SECRET;
    if (!secret) {
        console.warn("[revalidate-scheduler] REVALIDATE_SECRET is not set. Scheduled revalidation is disabled.");
        return;
    }

    const port = getServerPort();
    const strictWindow = reason === "scheduled" || reason === "startup-window";
    const strictWindowParam = strictWindow ? "&strictWindow=1" : "";
    const url = `http://127.0.0.1:${port}/api/revalidate?target=home${strictWindowParam}`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "x-revalidate-secret": secret,
                "user-agent": "chronon4-revalidate-scheduler",
            },
        });
        const body = await res.text();
        console.log(`[revalidate-scheduler] ${reason}: ${res.status} ${body}`);
        if (res.ok) {
            await markTodayRevalidated();
        }
    } catch (error) {
        console.error(`[revalidate-scheduler] ${reason}: failed`, error);
    }
}

function markerPathForDate(dateKey) {
    return path.join(MARKER_DIRECTORY, `${dateKey}.done`);
}

async function hasTodayRevalidateMarker() {
    try {
        await fs.access(markerPathForDate(getJstDateKey()));
        return true;
    } catch {
        return false;
    }
}

async function markTodayRevalidated() {
    await fs.mkdir(MARKER_DIRECTORY, { recursive: true });
    await fs.writeFile(markerPathForDate(getJstDateKey()), new Date().toISOString(), "utf8");
}

async function runStartupCatchUpIfNeeded() {
    if (!hasTodayTargetPassed()) return;
    if (await hasTodayRevalidateMarker()) return;

    await triggerHomeRevalidate("startup-catch-up");
}

function scheduleNextRevalidate() {
    if (process.env.REVALIDATE_SCHEDULER_ENABLED === "0") {
        console.log("[revalidate-scheduler] disabled by REVALIDATE_SCHEDULER_ENABLED=0");
        return;
    }

    if (!process.env.REVALIDATE_SECRET) {
        console.warn("[revalidate-scheduler] REVALIDATE_SECRET is not set. Scheduler will not start.");
        return;
    }

    const delayMs = getNextRevalidateDelayMs();
    const runAt = new Date(Date.now() + delayMs).toISOString();
    console.log(`[revalidate-scheduler] next home revalidate at ${runAt} (04:00 JST)`);

    setTimeout(async () => {
        await triggerHomeRevalidate("scheduled");
        scheduleNextRevalidate();
    }, delayMs);
}

function postStatsMarkerPath(dateKey = getJstDateKey()) {
    return path.join(MARKER_DIRECTORY, `post-stats-${dateKey}.done`);
}

async function hasTodayPostStatsMarker() {
    try {
        await fs.access(postStatsMarkerPath());
        return true;
    } catch {
        return false;
    }
}

async function runRecentPostStats(reason) {
    const scriptPath = path.join(process.cwd(), "scripts", "update-post-stats.mjs");
    try {
        await new Promise((resolve, reject) => {
            const processOptions = { stdio: "inherit", env: process.env };
            if (runtimeIdentity) Object.assign(processOptions, runtimeIdentity);
            const updater = spawnProcess(process.execPath, [scriptPath, "--recent"], processOptions);
            updater.on("error", reject);
            updater.on("exit", (code) => code === 0
                ? resolve(undefined)
                : reject(new Error(`post stats updater exited with ${code}`)));
        });
        await fs.mkdir(MARKER_DIRECTORY, { recursive: true });
        await fs.writeFile(postStatsMarkerPath(), new Date().toISOString(), "utf8");
        console.log(`[post-stats-scheduler] ${reason}: completed`);
    } catch (error) {
        console.error(`[post-stats-scheduler] ${reason}: failed`, error);
    }
}

async function runPostStatsCatchUpIfNeeded() {
    const parts = getJstParts();
    const target = getJstScheduleUtcMs(parts, POST_STATS_HOUR_JST, POST_STATS_MINUTE_JST);
    if (Date.now() < target || await hasTodayPostStatsMarker()) return;
    await runRecentPostStats("startup-catch-up");
}

function scheduleNextPostStats() {
    if (process.env.POST_STATS_SCHEDULER_ENABLED === "0") {
        console.log("[post-stats-scheduler] disabled by POST_STATS_SCHEDULER_ENABLED=0");
        return;
    }
    const delayMs = getNextPostStatsDelayMs();
    const runAt = new Date(Date.now() + delayMs).toISOString();
    console.log(`[post-stats-scheduler] next update at ${runAt} (05:00 JST)`);
    setTimeout(async () => {
        await runRecentPostStats("scheduled");
        scheduleNextPostStats();
    }, delayMs);
}

setTimeout(async () => {
    if (process.env.REVALIDATE_SCHEDULER_ENABLED === "0") return;

    if (process.env.REVALIDATE_RUN_ON_START_IN_WINDOW !== "0" && isInStartupWindow()) {
        await triggerHomeRevalidate("startup-window");
    } else {
        await runStartupCatchUpIfNeeded();
    }

    scheduleNextRevalidate();
}, 2000);

setTimeout(async () => {
    if (process.env.POST_STATS_SCHEDULER_ENABLED === "0") return;
    await runPostStatsCatchUpIfNeeded();
    scheduleNextPostStats();
}, 3000);

setInterval(() => {
    void cleanupExpiredAuthData().catch((error) => {
        console.error("[auth-cleanup] scheduled cleanup failed:", error);
    });
}, AUTH_CLEANUP_INTERVAL_MS);
