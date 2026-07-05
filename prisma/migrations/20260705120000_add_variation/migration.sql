-- CreateTable
CREATE TABLE "Variation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demoProjectId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "xeroQuoteId" TEXT NOT NULL,
    "xeroQuoteNumber" TEXT NOT NULL,
    "xeroQuoteStatus" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "subtotal" REAL NOT NULL,
    "totalTax" REAL NOT NULL,
    "total" REAL NOT NULL,
    "currencyCode" TEXT,
    "linesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Variation_demoProjectId_messageId_revision_key" ON "Variation"("demoProjectId", "messageId", "revision");
