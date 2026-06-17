-- CreateEnum
CREATE TYPE "EmailSuppressionReason" AS ENUM ('BOUNCED', 'COMPLAINED');

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "EmailSuppressionReason" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_email_key" ON "EmailSuppression"("email");

-- CreateIndex
CREATE INDEX "EmailSuppression_reason_idx" ON "EmailSuppression"("reason");
