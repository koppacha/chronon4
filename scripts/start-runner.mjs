import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const REVALIDATE_HOUR_JST = 0;
const REVALIDATE_MINUTE_JST = 5;
const REVALIDATE_WINDOW_MINUTES = 10;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PORT = "3004";
const MARKER_DIRECTORY = path.join(os.tmpdir(), "chronon4-revalidate");

function getServerPort() {
    return process.env.PORT || DEFAULT_PORT;
}

/** @type {import("node:child_process").SpawnOptions} */
const serverOptions = {
    stdio: "inherit",
    env: {
        ...process.env,
        PORT: getServerPort(),
    },
};

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

function getJstTargetUtcMs(parts) {
    return Date.UTC(
        parts.year,
        parts.month,
        parts.day,
        REVALIDATE_HOUR_JST,
        REVALIDATE_MINUTE_JST
    ) - JST_OFFSET_MS;
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
    console.log(`[revalidate-scheduler] next home revalidate at ${runAt} (00:05 JST)`);

    setTimeout(async () => {
        await triggerHomeRevalidate("scheduled");
        scheduleNextRevalidate();
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
