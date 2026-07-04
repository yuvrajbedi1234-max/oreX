-- CreateTable
CREATE TABLE "ScopeAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demoProjectId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "analyserType" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ScopeAnalysis_demoProjectId_messageId_key" ON "ScopeAnalysis"("demoProjectId", "messageId");
