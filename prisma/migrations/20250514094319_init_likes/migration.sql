-- CreateTable
CREATE TABLE "Like" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "flag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Like_articleId_sessionId_idx" ON "Like"("articleId", "sessionId");
