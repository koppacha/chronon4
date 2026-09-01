CREATE TABLE "PostReadAction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "referer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PostReadAction_actorType_actorId_eventId_key"
ON "PostReadAction"("actorType", "actorId", "eventId");

CREATE INDEX "PostReadAction_actorType_actorId_articleId_id_idx"
ON "PostReadAction"("actorType", "actorId", "articleId", "id");

CREATE INDEX "PostReadAction_createdAt_idx" ON "PostReadAction"("createdAt");

INSERT INTO "PostReadAction"
    ("actorType", "actorId", "articleId", "eventId", "isRead", "source", "referer", "createdAt")
SELECT
    'user', CAST("userId" AS TEXT), "articleId", "eventId", 1, 'migration', "referer", "createdAt"
FROM "ReadEvent";

INSERT INTO "PostReadAction"
    ("actorType", "actorId", "articleId", "eventId", "isRead", "source", "referer", "createdAt")
SELECT
    'user', CAST(state."userId" AS TEXT), state."articleId", 'legacy-state-' || state."id", 1,
    'migration', NULL, state."lastReadAt"
FROM "UserPostRead" AS state
WHERE NOT EXISTS (
    SELECT 1 FROM "ReadEvent" AS event
    WHERE event."userId" = state."userId" AND event."articleId" = state."articleId"
);
