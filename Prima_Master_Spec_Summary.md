# Prima — Master Specification Summary

> Full build reference for the Prima multi-tenant DSR SaaS platform.
> See `Prima_StepByStep_Prompts.md` for phase-by-phase prompts.

## Overview

Prima is an intelligent multi-tenant Daily Sales Reporting (DSR) SaaS platform.
Super Admin manages tenants; tenants manage their own sales ops (DSRs, invoices, payments, inventory, AI insights).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript strict mode) |
| Styling | Tailwind CSS v4, shadcn/ui |
| ORM | Prisma 6 + PostgreSQL 16 (pgvector) |
| Auth | Better Auth (or NextAuth v5) |
| Validation | Zod + React Hook Form |
| Jobs | BullMQ + Redis |
| Email | Resend + React Email |
| Charts | Recharts |
| AI | Vercel AI SDK (model-agnostic: Claude, OpenAI, Gemini, Ollama) |
| Storage | Cloudflare R2 |
| Deployment | Vercel + Neon/Supabase + Upstash |

---

## Key Architecture Patterns

- **TenantScopedRepository**: every Prisma query scoped by `organizationId` — no cross-tenant data leaks
- **Subdomain routing**: `{slug}.localhost:3000` maps to the correct Organization
- **Permission system**: slugs enforced on every API route + conditional UI via `hasPermission(user, slug)` and `<PermissionGate>`
- **AI provider factory**: `getAIProvider(org)` returns correct provider based on `OrganizationAISettings`
- **Token wallet**: every AI call logged to `TokenUsageLog`; monthly budget enforced with auto-top-up

---

## Phase Summary

### Phase 0 — Foundation
- Next.js 15 project setup, ESLint, Prettier, Husky
- Docker Compose: PostgreSQL 16 (pgvector) + Redis
- Prisma schema: `SuperAdmin`, `Organization`, `UserSession`, `PlatformSettings`, `PlatformAuditLog`, `OrganizationInvoice`
- Auth: login/logout/reset/verify, separate flows for Super Admin (`/super-admin/login`) and Tenants (`/login`)
- Multi-tenancy middleware + `TenantContext`
- Super Admin panel: organizations CRUD, sub-admin management, platform settings
- Tenant onboarding wizard (4 steps)
- shadcn/ui + dark mode + toast notifications
- Vitest + Playwright setup

### Phase 1 — Identity
- Prisma: `User`, `Role`, `Department`, `UserInvitation`, `AuditLog`, `Notification`
- Permission slugs + `hasPermission()` + `requirePermission()` middleware + `usePermission()` hook
- Roles & Permissions UI with custom role builder
- User management: invite, edit, suspend, bulk actions
- Department CRUD with nested tree
- Full branding customization (logo, colors, fonts, live preview)
- Audit log viewer, notification bell, profile + MFA

### Phase 2 — Business Entities
- Prisma: `Distributor`, `Client`, `Product`, `Warehouse`, `InventoryStock`, `InventoryTransaction`
- pgvector column on `Product` (used in Phase 5)
- Distributors + Clients: full CRUD, bulk import/export CSV/Excel, auto-generated codes
- Product catalog: SKU, barcode, images, categories, pricing
- Warehouse & inventory: stock levels, adjustments, transfers, stock-take
- Reusable `<DataTable>`, `<FilterPanel>`, `<FileUploader>` components

### Phase 3 — DSR & Invoicing
- Prisma: `DSREntry`, `DSRLineItem`, `Invoice`, `InvoiceLineItem`, `Payment`, `PaymentReminder`, `SalesTarget`, `PerformanceSnapshot`
- DSR submission (sales rep), approval/rejection (manager), atomic transaction on approval
- Invoice template builder (visual, with live preview)
- Invoice lifecycle: Draft → Issued → Partially Paid → Paid / Overdue / Cancelled
- PDF generation, email sending, open tracking
- Payment recording (partial allowed), receipt email
- Auto payment reminders via BullMQ cron
- Sales targets with progress tracking

### Phase 4 — Dashboards (11 total)
- Shared widget library: `<KPICard>`, `<LineChartCard>`, `<BarChartCard>`, `<DonutChartCard>`, `<GaugeWidget>`, `<MapWidget>`, `<Leaderboard>`
- 11 dashboards: Super Admin, Tenant Executive, Sales, Distributors, Single Distributor, Clients, Inventory, Financial, EPR, Per-Employee, Manager, Sales Rep
- Aggregation API endpoints with Redis caching (5 min TTL)
- Materialized views refreshed nightly
- Drag-and-drop widget customization (dnd-kit), saved per user
- Export: CSV, Excel, PDF

### Phase 5 — AI Intelligence Layer
- Prisma: `OrganizationAISettings`, `AIRecommendation`, `AIConversation`, `AIInsight`, `TokenWallet`, `TokenUsageLog`
- AI provider abstraction: `IAIProvider` → Claude, OpenAI, Gemini, Ollama implementations
- Token wallet: usage tracking, budget enforcement, auto-top-up
- AI settings UI + usage dashboard
- Nightly inventory demand prediction (statistical forecast + LLM explanation)
- Daily dormant client detection
- Payment behavior scoring (0–100, triggered on every payment)
- Anomaly detection every 6 hours
- AI chat assistant: streaming, tool-calling, RAG with pgvector
- Smart target suggestions, upsell/cross-sell via product embeddings
- Natural language report summaries (cached 1 hour)

### Phase 6 — Platform Billing
- Subscription plans: Starter, Pro, Business, Enterprise
- Tenant self-service billing page
- Token top-up packs + auto-top-up
- Monthly platform invoicing via BullMQ cron
- Payment providers: Stripe + Manual (+ optional JazzCash/EasyPaisa)
- Subscription lifecycle enforcement: trial → paid → past-due → suspended → cancelled
- Coupons & promotions
- Super Admin revenue dashboards (MRR, ARR, cohort, churn)

### Phase 7 — Polish & Launch
- Performance: Lighthouse >90, <3s TTI, fix N+1 queries, Redis caching
- Accessibility: WCAG 2.1 AA
- Security: tenant isolation tests, rate limiting, CSP, PII encryption
- Error handling: Sentry, global error boundary, friendly error pages
- i18n: next-intl (English default, RTL-ready for Urdu)
- Monitoring: Sentry + PostHog + UptimeRobot + BullMQ alerts
- Public landing page + pricing + docs + legal pages
- Deployment: Vercel + Neon + Upstash + R2 + Resend + custom domain

---

## Page Route Map (key routes)

```
/                          Public landing page
/login                     Tenant login
/super-admin/login         Super Admin login
/super-admin/dashboard     Platform overview
/super-admin/organizations Tenant list & management
/onboarding                Tenant onboarding wizard
/admin                     Tenant Executive Dashboard
/admin/users               User management
/admin/settings/roles      Role & permission builder
/admin/settings/departments Departments
/admin/settings/branding   Visual customization
/admin/settings/ai         AI configuration
/admin/distributors        Distributor CRUD
/admin/clients             Client CRUD
/admin/products            Product catalog
/admin/inventory           Stock management
/admin/invoices            Invoice management
/admin/targets             Sales targets
/admin/recommendations     AI recommendations feed
/admin/ai-assistant        Full-page AI chat
/admin/dashboards/sales    Sales Dashboard
/admin/dashboards/financial Financial Dashboard
/admin/dashboards/epr      Employee Performance
/manager                   Manager team dashboard
/dashboard                 Sales Rep personal dashboard
/dashboard/dsr/new         Submit DSR
```
