-- CreateEnum
CREATE TYPE "AIRecommendationType" AS ENUM ('DORMANT_CLIENT', 'INVENTORY_REORDER', 'ANOMALY_REVENUE', 'ANOMALY_DSR_SKIP', 'ANOMALY_VELOCITY', 'ANOMALY_ORDER_SPIKE', 'PAYMENT_RISK', 'UPSELL', 'TARGET_SUGGESTION');

-- CreateEnum
CREATE TYPE "AIRecommendationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AIRecommendationStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'DISMISSED', 'ACTED_ON');

-- CreateEnum
CREATE TYPE "AIProviderType" AS ENUM ('CLAUDE', 'OPENAI', 'GEMINI', 'OLLAMA');

-- CreateEnum
CREATE TYPE "PaymentBehaviorLabel" AS ENUM ('EXCELLENT', 'GOOD', 'AVERAGE', 'RISKY', 'DEFAULTER');

-- CreateTable
CREATE TABLE "OrganizationAISettings" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "perUserQuotasEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultUserQuota" INTEGER NOT NULL DEFAULT 10000,
    "ollamaBaseUrl" TEXT,
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "predictionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "summariesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "anomalyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAISettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "AIRecommendationType" NOT NULL,
    "severity" "AIRecommendationSeverity" NOT NULL DEFAULT 'INFO',
    "status" "AIRecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "actions" JSONB,
    "targetUserId" UUID,
    "entityType" TEXT,
    "entityId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" UUID,
    "dismissedAt" TIMESTAMP(3),
    "dismissedBy" UUID,
    "actedOnAt" TIMESTAMP(3),
    "actedOnBy" UUID,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "dataHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenWallet" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalPurchased" INTEGER NOT NULL DEFAULT 0,
    "totalConsumed" INTEGER NOT NULL DEFAULT 0,
    "monthlyUsed" INTEGER NOT NULL DEFAULT 0,
    "monthlyResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTopUpPack" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "priceUsd" DECIMAL(8,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenTopUpPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsageLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPrediction" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "demand30Days" DECIMAL(12,2) NOT NULL,
    "demand60Days" DECIMAL(12,2) NOT NULL,
    "demand90Days" DECIMAL(12,2) NOT NULL,
    "reorderQty" INTEGER NOT NULL,
    "reorderByDate" TIMESTAMP(3) NOT NULL,
    "stockoutRiskDate" TIMESTAMP(3),
    "trend" TEXT,
    "seasonality" TEXT,
    "confidence" DECIMAL(3,2),
    "explanation" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" UUID,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAISettings_organizationId_key" ON "OrganizationAISettings"("organizationId");

-- CreateIndex
CREATE INDEX "AIRecommendation_organizationId_status_idx" ON "AIRecommendation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AIRecommendation_organizationId_type_idx" ON "AIRecommendation"("organizationId", "type");

-- CreateIndex
CREATE INDEX "AIRecommendation_targetUserId_idx" ON "AIRecommendation"("targetUserId");

-- CreateIndex
CREATE INDEX "AIRecommendation_entityType_entityId_idx" ON "AIRecommendation"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AIRecommendation_createdAt_idx" ON "AIRecommendation"("createdAt");

-- CreateIndex
CREATE INDEX "AIConversation_organizationId_userId_deletedAt_idx" ON "AIConversation"("organizationId", "userId", "deletedAt");

-- CreateIndex
CREATE INDEX "AIConversation_createdAt_idx" ON "AIConversation"("createdAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AIMessage_createdAt_idx" ON "AIMessage"("createdAt");

-- CreateIndex
CREATE INDEX "AIInsight_organizationId_expiresAt_idx" ON "AIInsight"("organizationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIInsight_organizationId_widgetKey_key" ON "AIInsight"("organizationId", "widgetKey");

-- CreateIndex
CREATE UNIQUE INDEX "TokenWallet_organizationId_key" ON "TokenWallet"("organizationId");

-- CreateIndex
CREATE INDEX "TokenTopUpPack_isActive_idx" ON "TokenTopUpPack"("isActive");

-- CreateIndex
CREATE INDEX "TokenUsageLog_organizationId_createdAt_idx" ON "TokenUsageLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenUsageLog_organizationId_userId_idx" ON "TokenUsageLog"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_organizationId_feature_idx" ON "TokenUsageLog"("organizationId", "feature");

-- CreateIndex
CREATE INDEX "TokenUsageLog_createdAt_idx" ON "TokenUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryPrediction_organizationId_idx" ON "InventoryPrediction"("organizationId");

-- CreateIndex
CREATE INDEX "InventoryPrediction_productId_idx" ON "InventoryPrediction"("productId");

-- CreateIndex
CREATE INDEX "InventoryPrediction_generatedAt_idx" ON "InventoryPrediction"("generatedAt");

-- CreateIndex
CREATE INDEX "InventoryPrediction_stockoutRiskDate_idx" ON "InventoryPrediction"("stockoutRiskDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPrediction_organizationId_productId_key" ON "InventoryPrediction"("organizationId", "productId");

-- AddForeignKey
ALTER TABLE "OrganizationAISettings" ADD CONSTRAINT "OrganizationAISettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenWallet" ADD CONSTRAINT "TokenWallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsageLog" ADD CONSTRAINT "TokenUsageLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPrediction" ADD CONSTRAINT "InventoryPrediction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPrediction" ADD CONSTRAINT "InventoryPrediction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Post-Phase-5 review fixes (were applied via `prisma db push` at the time;
-- recorded here so migration history rebuilds an identical database)
ALTER TABLE "AIConversation" ADD COLUMN "lastModifiedBy" TEXT;
ALTER TABLE "AIRecommendation" ADD COLUMN "lastModifiedBy" TEXT;
ALTER TABLE "AIMessage" ADD COLUMN "organizationId" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "AIMessage_organizationId_idx" ON "AIMessage"("organizationId");
CREATE INDEX "Client_organizationId_assignedRepId_idx" ON "Client"("organizationId", "assignedRepId");
CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");
CREATE INDEX "Payment_organizationId_invoiceId_idx" ON "Payment"("organizationId", "invoiceId");
