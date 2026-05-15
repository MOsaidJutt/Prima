-- Phase 4 Performance Indexes
-- These indexes optimize dashboard aggregation queries

-- DSREntry: filter by org+date+status (dashboard queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DSREntry_org_date_idx" ON "DSREntry"("organizationId", "reportDate" DESC, "deletedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DSREntry_org_submitted_date_idx" ON "DSREntry"("organizationId", "submittedById", "reportDate" DESC, "deletedAt");

-- Invoice: filter by org+date+status (revenue aggregations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Invoice_org_issueDate_idx" ON "Invoice"("organizationId", "issueDate" DESC, "deletedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Invoice_org_status_idx" ON "Invoice"("organizationId", "status", "deletedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Invoice_org_createdBy_date_idx" ON "Invoice"("organizationId", "createdById", "issueDate" DESC, "deletedAt");

-- Payment: filter by org+date (collections)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_org_date_idx" ON "Payment"("organizationId", "paymentDate" DESC, "deletedAt");

-- Client: filter by org+status (dashboard counts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Client_org_status_createdAt_idx" ON "Client"("organizationId", "status", "createdAt" DESC, "deletedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Client_org_ltv_idx" ON "Client"("organizationId", "totalLifetimeValue" DESC, "deletedAt");

-- Distributor: filter by org+status+tier
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Distributor_org_status_tier_idx" ON "Distributor"("organizationId", "status", "tier", "deletedAt");

-- InventoryStock: filter by org+product
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryStock_org_product_idx" ON "InventoryStock"("organizationId", "productId");

-- InventoryTransaction: filter by org+date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryTransaction_org_createdAt_idx" ON "InventoryTransaction"("organizationId", "createdAt" DESC);

-- PerformanceSnapshot: filter by org+userId+date (EPR queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceSnapshot_org_user_date_idx" ON "PerformanceSnapshot"("organizationId", "userId", "snapshotDate" DESC);

-- User: filter by org+active+dept
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_org_active_dept_idx" ON "User"("organizationId", "isActive", "departmentId", "deletedAt");

-- Materialized views for dashboard aggregations
-- Daily revenue per org
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_daily_revenue" AS
SELECT
  "organizationId",
  DATE("issueDate") AS "date",
  SUM("grandTotal") AS "invoiced",
  SUM("paidAmount") AS "collected",
  COUNT(*) AS "invoice_count"
FROM "Invoice"
WHERE "deletedAt" IS NULL
GROUP BY "organizationId", DATE("issueDate")
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "mv_daily_revenue_org_date_idx" ON "mv_daily_revenue"("organizationId", "date");

-- Monthly performance per user
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_monthly_user_perf" AS
SELECT
  d."organizationId",
  d."submittedById" AS "userId",
  DATE_TRUNC('month', d."reportDate") AS "month",
  COUNT(*) AS "dsr_count",
  SUM(CASE WHEN d.status = 'APPROVED' THEN 1 ELSE 0 END) AS "approved_count",
  COALESCE(SUM(d."grandTotal"), 0) AS "total_value"
FROM "DSREntry" d
WHERE d."deletedAt" IS NULL
GROUP BY d."organizationId", d."submittedById", DATE_TRUNC('month', d."reportDate")
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "mv_monthly_user_perf_idx" ON "mv_monthly_user_perf"("organizationId", "userId", "month");
