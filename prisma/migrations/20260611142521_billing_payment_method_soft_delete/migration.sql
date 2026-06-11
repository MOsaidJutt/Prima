-- AlterTable
ALTER TABLE "BillingPaymentMethod" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BillingPaymentMethod_deletedAt_idx" ON "BillingPaymentMethod"("deletedAt");
