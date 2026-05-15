-- CreateTable
CREATE TABLE "InvoiceNumberSequence" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceNumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceNumberSequence_organizationId_key" ON "InvoiceNumberSequence"("organizationId");

-- CreateIndex
CREATE INDEX "DSREntry_organizationId_status_deletedAt_idx" ON "DSREntry"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_issueDate_idx" ON "Invoice"("organizationId", "issueDate");

-- AddForeignKey
ALTER TABLE "InvoiceNumberSequence" ADD CONSTRAINT "InvoiceNumberSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
