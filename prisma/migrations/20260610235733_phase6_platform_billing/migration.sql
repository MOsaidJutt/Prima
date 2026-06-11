-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "PaymentProviderType" AS ENUM ('MANUAL', 'STRIPE', 'JAZZCASH', 'EASYPAISA');

-- CreateEnum
CREATE TYPE "TopUpOrderStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PlatformPaymentType" AS ENUM ('SUBSCRIPTION', 'SETUP_FEE', 'TOPUP', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PlatformPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FLAT');

-- CreateEnum
CREATE TYPE "PromotionAppliesTo" AS ENUM ('ALL', 'ANNUAL', 'NEW_SIGNUPS');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "gracePeriodEndsAt" TIMESTAMP(3),
ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "pastDueAt" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiQuotaResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "aiQuotaUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiTokenQuota" INTEGER;

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" UUID NOT NULL,
    "tier" "SubscriptionPlan" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "annualPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "setupFee" DECIMAL(10,2) NOT NULL DEFAULT 20000,
    "maxUsers" INTEGER,
    "aiTokensIncluded" INTEGER NOT NULL DEFAULT 0,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "perUserQuotasEnabled" BOOLEAN NOT NULL DEFAULT false,
    "invoiceTemplateLimit" INTEGER,
    "customDomain" BOOLEAN NOT NULL DEFAULT false,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "sla" TEXT,
    "features" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPaymentMethod" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "provider" "PaymentProviderType" NOT NULL,
    "providerCustomerId" TEXT,
    "providerPaymentMethodId" TEXT,
    "brand" TEXT,
    "last4" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTopUpOrder" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "tokens" INTEGER NOT NULL,
    "priceUsd" DECIMAL(8,2) NOT NULL,
    "status" "TopUpOrderStatus" NOT NULL DEFAULT 'PENDING',
    "isAutoTopUp" BOOLEAN NOT NULL DEFAULT false,
    "provider" "PaymentProviderType" NOT NULL,
    "providerRef" TEXT,
    "failedReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenTopUpOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType",
    "discountValue" DECIMAL(10,2),
    "setupFeeWaiver" BOOLEAN NOT NULL DEFAULT false,
    "bonusTokens" INTEGER NOT NULL DEFAULT 0,
    "applicablePlans" "SubscriptionPlan"[] DEFAULT ARRAY[]::"SubscriptionPlan"[],
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "discountApplied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonusTokensGranted" INTEGER NOT NULL DEFAULT 0,
    "setupFeeWaived" BOOLEAN NOT NULL DEFAULT false,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType",
    "discountValue" DECIMAL(10,2),
    "setupFeeWaiver" BOOLEAN NOT NULL DEFAULT false,
    "bonusTokens" INTEGER NOT NULL DEFAULT 0,
    "appliesTo" "PromotionAppliesTo" NOT NULL DEFAULT 'ALL',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "PlatformPaymentType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "provider" "PaymentProviderType" NOT NULL,
    "providerRef" TEXT,
    "status" "PlatformPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceId" UUID,
    "topUpOrderId" UUID,
    "notes" TEXT,
    "recordedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlan_tier_key" ON "BillingPlan"("tier");

-- CreateIndex
CREATE INDEX "BillingPlan_isActive_idx" ON "BillingPlan"("isActive");

-- CreateIndex
CREATE INDEX "BillingPaymentMethod_organizationId_idx" ON "BillingPaymentMethod"("organizationId");

-- CreateIndex
CREATE INDEX "TokenTopUpOrder_organizationId_status_idx" ON "TokenTopUpOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TokenTopUpOrder_createdAt_idx" ON "TokenTopUpOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_isActive_idx" ON "Coupon"("isActive");

-- CreateIndex
CREATE INDEX "CouponRedemption_organizationId_idx" ON "CouponRedemption"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_couponId_organizationId_key" ON "CouponRedemption"("couponId", "organizationId");

-- CreateIndex
CREATE INDEX "Promotion_isActive_idx" ON "Promotion"("isActive");

-- CreateIndex
CREATE INDEX "PlatformPayment_organizationId_status_idx" ON "PlatformPayment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PlatformPayment_type_idx" ON "PlatformPayment"("type");

-- CreateIndex
CREATE INDEX "PlatformPayment_providerRef_idx" ON "PlatformPayment"("providerRef");

-- AddForeignKey
ALTER TABLE "BillingPaymentMethod" ADD CONSTRAINT "BillingPaymentMethod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTopUpOrder" ADD CONSTRAINT "TokenTopUpOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTopUpOrder" ADD CONSTRAINT "TokenTopUpOrder_packId_fkey" FOREIGN KEY ("packId") REFERENCES "TokenTopUpPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

