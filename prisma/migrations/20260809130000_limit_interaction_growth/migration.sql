-- Keep the latest anonymous Like state for each article/session before enforcing uniqueness.
DELETE FROM "Like"
WHERE "id" NOT IN (
  SELECT MAX("id")
  FROM "Like"
  GROUP BY "articleId", "sessionId"
);

DROP INDEX IF EXISTS "Like_articleId_sessionId_idx";
CREATE UNIQUE INDEX "Like_articleId_sessionId_key" ON "Like"("articleId", "sessionId");
CREATE INDEX "ReadEvent_createdAt_idx" ON "ReadEvent"("createdAt");
