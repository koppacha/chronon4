-- Store precomputed article character counts. A full population is an explicit
-- maintenance operation; the production scheduler refreshes recent articles.
CREATE TABLE "ArticleCharacterCount" (
    "articleId" INTEGER NOT NULL PRIMARY KEY,
    "characterCount" INTEGER NOT NULL,
    "sourceModifiedAt" DATETIME NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ArticleCharacterCount_sourceModifiedAt_idx"
ON "ArticleCharacterCount"("sourceModifiedAt");
