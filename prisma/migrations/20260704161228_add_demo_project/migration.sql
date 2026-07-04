-- CreateTable
CREATE TABLE "DemoProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "xeroTenantId" TEXT NOT NULL,
    "xeroContactId" TEXT NOT NULL,
    "xeroSourceQuoteId" TEXT NOT NULL,
    "xeroSourceQuoteNumber" TEXT NOT NULL,
    "seedReference" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoProject_slug_key" ON "DemoProject"("slug");
