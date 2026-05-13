# Prima — Master Specification Summary

> Full build reference for the Prima multi-tenant DSR SaaS platform.
> See `Prima_StepByStep_Prompts.md` for phase-by-phase prompts.
> Multi-platform addendum: `Prima_Multi_Platform_Addendum.md`

## Overview

Prima is an intelligent multi-tenant Daily Sales Reporting (DSR) SaaS platform delivering **web, desktop (Tauri), and mobile (Expo)** experiences from a shared codebase. Super Admin manages tenants; tenants manage their own sales ops (DSRs, invoices, payments, inventory, AI insights) — **including offline, with automatic sync across all devices**.

---

## Tech Stack

| Layer            | Technology                                                             |
| ---------------- | ---------------------------------------------------------------------- |
| **Web**          | Next.js 16 (App Router, TypeScript strict) — canonical implementation  |
| **Desktop**      | Tauri 2.0 — wraps Next.js web build (~3MB bundle, macOS/Windows/Linux) |
| **Mobile**       | Expo + React Native (iOS 15+, Android 8+, EAS Build, OTA updates)      |
| **Monorepo**     | Turborepo — `apps/web`, `apps/desktop`, `apps/mobile`, `packages/*`    |
| Styling          | Tailwind CSS v4, shadcn/ui                                             |
| ORM              | Prisma 6 + PostgreSQL 16 (pgvector)                                    |
| Auth             | Custom JWT (jose) — separate super-admin / tenant session cookies      |
| Validation       | Zod + React Hook Form                                                  |
| Jobs             | BullMQ + Redis                                                         |
| Email            | Resend + React Email                                                   |
| Charts           | Recharts                                                               |
| **Offline Sync** | PowerSync (PostgreSQL ↔ SQLite, CDC, conflict resolution)              |
| AI               | Vercel AI SDK (model-agnostic: Claude, OpenAI, Gemini, Ollama)         |
| Storage          | Cloudflare R2                                                          |
| Deployment       | Vercel (web) + EAS Build (mobile) + GitHub Releases (desktop)          |

---

## Multi-Platform Architecture (Addendum)

### Platform Summary

| Platform | Tech       | Status            | Scope                            |
| -------- | ---------- | ----------------- | -------------------------------- |
| Web      | Next.js 16 | ✅ Phase 0 done   | Full product + Super Admin       |
| Desktop  | Tauri 2.0  | Planned (Phase 6) | Wraps web build, native extras   |
| iOS      | Expo RN    | Planned (Phase 5) | Mobile DSR, offline, camera, GPS |
| Android  | Expo RN    | Planned (Phase 5) | Same as iOS                      |

### Offline Sync (PowerSync)

- Each device gets a **local SQLite database** synced from PostgreSQL via PowerSync CDC
- Two-way sync: device writes go up; server changes come down
- **Selective sync**: devices only receive data scoped to their `organizationId` and `userId`
- **Conflict resolution per table**:
  - Last-write-wins: `DSREntry`, `Notes`, `ClientNotes`
  - Server-wins: `Invoice`, `Payment` (financial integrity)
  - Custom merge: additive operations (cart-style line items)

### What Works Offline

- Submit DSR (queued locally, synced on reconnect)
- View synced clients, products, distributors
- View own historical reports
- Draft invoices (numbering assigned server-side when online)
- Photo attachments (uploaded when online)

### What Requires Online

- Initial authentication (cached JWT valid 24h offline)
- Issuing invoices (sequential numbering from server)
- Recording payments (requires server confirmation)
- Inviting users, bulk operations
- All AI features (chat, predictions, scoring)

### Platform-Specific Features

**Mobile only:** Camera DSR evidence, GPS visit capture, barcode scanning, biometric auth, push notifications, voice notes (AI-transcribed)
**Desktop only:** Keyboard shortcuts, multi-window, native file system (drag PDFs), system tray quick stats
**Web only:** Public marketing site, Super Admin panel

### Monorepo Structure (Target — Phase 1a)

```
prima/
├── apps/
│   ├── web/              ← Next.js (current Phase 0 code)
│   ├── desktop/          ← Tauri shell
│   └── mobile/           ← Expo React Native
├── packages/
│   ├── database/         ← Prisma schema + migrations + generated types
│   ├── api/              ← Typed REST client (or tRPC)
│   ├── auth/             ← Auth logic shared across platforms
│   ├── business-logic/   ← Domain calculations, validations
│   ├── sync/             ← PowerSync config and helpers
│   ├── ui/               ← Shared UI components (web-compatible subset)
│   └── types/            ← Shared TypeScript types
├── turbo.json
└── package.json
```

---

## Schema Requirements for Sync (Non-Negotiable)

All domain tables (Phase 1+) MUST follow these rules for PowerSync to work:

| Requirement       | Rule                                                      | Why                                                    |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Primary keys      | `@default(uuid())` — NOT `cuid()`, NOT autoincrement      | Devices generate IDs offline; integers/cuids collide   |
| Timestamps        | `createdAt`, `updatedAt` on every table                   | Sync engine determines newer version by `updatedAt`    |
| Soft deletes      | `deletedAt DateTime?` — never run `DELETE` on domain data | Hard deletes can't sync; other devices need tombstones |
| Timestamp format  | All UTC, stored as `DateTime` (Prisma maps to ISO-8601)   | Time zone confusion across devices                     |
| Org scoping       | `organizationId` on every domain table                    | Already in spec; also used for selective sync          |
| Conflict metadata | `lastModifiedBy String?`, `lastModifiedDevice String?`    | Conflict resolution and audit trail                    |
| Invoice numbers   | Generated server-side ONLY when synced online             | Client-generated numbers would collide                 |

> **Phase 0 note**: Phase 0 models (`SuperAdmin`, `Organization`, `PlatformSettings`, etc.) are web-only and managed exclusively by server. They do NOT sync to devices and are exempt from the UUID/soft-delete requirements — but will be migrated to UUIDs in Phase 1a for consistency.

---

## Phase 0 → Phase 1 Conflict Analysis & Migration Plan

### Conflicts Identified

| Item                                    | Phase 0 State                        | Addendum Requirement                       | Impact                                            |
| --------------------------------------- | ------------------------------------ | ------------------------------------------ | ------------------------------------------------- |
| Primary keys                            | `@default(cuid())` on all models     | Must be `uuid()` for offline ID generation | **Breaking** — requires schema migration + reseed |
| Soft deletes                            | Not present on any model             | `deletedAt DateTime?` on all domain tables | Additive — add columns in Phase 1a migration      |
| `lastModifiedBy` / `lastModifiedDevice` | Not present                          | Required on all mutable domain tables      | Additive — add in Phase 1a                        |
| Monorepo structure                      | Flat Next.js at root                 | `apps/web/` in Turborepo                   | Requires file move + import updates               |
| Auth system                             | Custom JWT (jose) at `src/lib/auth/` | Needs to live in `packages/auth/`          | Path change only after monorepo migration         |

### Migration Plan (No Code Changes Yet — Proposal Only)

**Phase 1a — Monorepo Restructure** _(before any new feature work)_

1. Install Turborepo at root
2. Move `src/`, `prisma/`, `public/`, `next.config.ts`, etc. → `apps/web/`
3. Create `packages/database/` — move Prisma schema + seed there
4. Create `packages/types/` — move `src/types/index.ts` there
5. Create `packages/auth/` — move `src/lib/auth/` there
6. Update all `@/` imports throughout `apps/web/`
7. Wire Turborepo pipeline (`build`, `dev`, `lint`, `test`)
8. Verify `npm run dev` still works from root

**Phase 1b — Schema Sync-Readiness** _(immediately after monorepo)_

1. Change all `@id @default(cuid())` → `@id @default(uuid()) @db.Uuid` in `packages/database/schema.prisma`
2. Add `deletedAt DateTime?` to `Organization` and all future domain models
3. Add `lastModifiedBy String?` and `lastModifiedDevice String?` to all future mutable domain models
4. Run `prisma migrate dev --name sync-readiness`
5. Update seed to use UUIDs explicitly (or let Postgres gen_random_uuid() handle it)
6. Update `TenantScopedRepository` to filter `deletedAt: null` by default

**Phase 1c — Original Phase 1 Feature Work**

- Users, Roles, Departments, Branding, Audit Log
- All new models built with UUID PKs + soft deletes from the start

### Recommended Approach: Staged Rollout

Per the addendum's own recommendation, **build the web app completely first**, then add mobile/desktop:

| Sprint                | Timeline     | Deliverable                  |
| --------------------- | ------------ | ---------------------------- |
| Sprint 1 (Phases 0–7) | Now → Week 8 | Full web app, all features   |
| Sprint 2              | Week 9–10    | PWA mode (offline-ish, free) |
| Sprint 3              | Week 11–16   | Expo mobile app + PowerSync  |
| Sprint 4              | Week 17–22   | Tauri desktop app            |

**Rationale**: Get paying customers by month 2–3. Validate product-market fit before investing in 3 additional codebases. Schema sync requirements (UUIDs, soft deletes) are applied from Phase 1 onward regardless — so mobile/desktop readiness is built in without blocking web delivery.

---

## Key Architecture Patterns

- **TenantScopedRepository**: every Prisma query scoped by `organizationId` — no cross-tenant data leaks
- **Subdomain routing**: `{slug}.localhost:3000` maps to the correct Organization
- **Permission system**: slugs enforced on every API route + conditional UI via `hasPermission(user, slug)` and `<PermissionGate>`
- **AI provider factory**: `getAIProvider(org)` returns correct provider based on `OrganizationAISettings`
- **Token wallet**: every AI call logged to `TokenUsageLog`; monthly budget enforced with auto-top-up

---

## UI/UX Design System

> Derived from Antigravity Kit (ui-ux-pro-max-skill) recommendations for B2B SaaS analytics dashboards.

### Design Philosophy

- **Style**: Minimalism & Swiss Style — clean, functional, high-contrast, grid-based. No unnecessary shadows or gradients. Clarity over decoration.
- **Dashboard style**: Data-Dense + Drill-Down Analytics. Information hierarchy over aesthetics.
- **Accessibility**: WCAG AA minimum; AAA where feasible.

### Color Palettes

**Light mode (B2B Service — Professional Navy)**
| Token | Value | Usage |
|---|---|---|
| `--primary` | `#0F172A` | Sidebar, primary buttons |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--secondary` | `#334155` | Secondary UI elements |
| `--accent` | `#0369A1` | CTA highlights, links, active states |
| `--background` | `#F8FAFC` | Page background |
| `--foreground` | `#020617` | Body text |
| `--card` | `#FFFFFF` | Card backgrounds |
| `--muted` | `#E8ECF1` | Disabled, subtle backgrounds |
| `--muted-foreground` | `#64748B` | Placeholder text, labels |
| `--border` | `#E2E8F0` | Dividers, input borders |
| `--destructive` | `#DC2626` | Errors, danger actions |

**Dark mode (OLED Financial — Trust Dark)**
| Token | Value | Usage |
|---|---|---|
| `--primary` | `#0F172A` | Same — dark bg becomes primary canvas |
| `--background` | `#020617` | Deep OLED black background |
| `--card` | `#0E1223` | Card surfaces |
| `--secondary` | `#1E293B` | Secondary surfaces |
| `--accent` | `#22C55E` | Positive indicators, CTA on dark |
| `--muted` | `#1A1E2F` | Subtle containers |
| `--muted-foreground` | `#94A3B8` | Secondary text |
| `--border` | `#334155` | Dividers on dark |
| `--destructive` | `#EF4444` | Errors on dark |
| `--foreground` | `#F8FAFC` | Body text on dark |

**Semantic status colors** (consistent light + dark)
| Status | Color | Usage |
|---|---|---|
| Success / Positive | `#22C55E` | Paid, approved, on-target |
| Warning | `#F59E0B` | Trial, pending, at-risk |
| Danger | `#EF4444` | Overdue, suspended, default |
| Info | `#0369A1` (light) / `#38BDF8` (dark) | Neutral notifications |

### Typography

- **Primary font**: **Plus Jakarta Sans** — friendly, modern SaaS font. Best for: B2B products, dashboards, productivity tools.
  ```
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
  ```
- **Monospace** (for amounts, codes, IDs): **Fira Code** — cohesive dashboard data display.
- **Tailwind config**:
  ```js
  fontFamily: {
    sans: ['Plus Jakarta Sans', 'sans-serif'],
    mono: ['Fira Code', 'monospace'],
  }
  ```

### Component Principles

- **Spacing**: 2rem base gap. Grid: 12–16 columns. No extreme whitespace — data is dense.
- **Border radius**: `0.375rem` (6px) — subtle, professional. Not pill-shaped.
- **Shadows**: Minimal. Only on cards and modals: `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`.
- **Animations**: Subtle hover 200ms ease. No bounce or spring — enterprise feel.
- **Tables**: Sticky header, row hover `bg-muted/40`, border-b between rows.
- **Sidebar**: Fixed, collapsible, `w-64` expanded / `w-16` collapsed. Primary bg color on active item.
- **KPI Cards**: Value large (`text-3xl font-bold`), label small muted, trend badge colored.
- **Charts**: Recharts with custom theme colors. Always include loading skeleton.

### Dark/Light Toggle

- Persisted in `user.preferences` JSON column (Phase 1).
- System default on first visit (`defaultTheme="system"`).
- Toggle in TopBar using `next-themes`.

---

## Phase Summary (Revised Build Order)

> Phases 0–7 = web app first (staged rollout). Mobile + Desktop in Phases 8–9.

### Phase 0 — Foundation ✅ COMPLETE (`v0.1.0-phase0`)

- Next.js 16 project setup, ESLint, Prettier, Husky, git tags
- Docker Compose: PostgreSQL 16 (pgvector) + Redis
- Prisma 6 schema: `SuperAdmin`, `Organization`, `UserSession`, `PlatformSettings`, `PlatformAuditLog`, `OrganizationInvoice`
- Custom JWT auth (jose) — separate super-admin / tenant cookies
- Multi-tenancy middleware + `TenantScopedRepository`
- Super Admin panel: organizations CRUD, admins, settings
- Tenant onboarding wizard (4 steps)
- B2B navy + OLED dark design system, Plus Jakarta Sans font
- Vitest (5/5) + Playwright E2E config
- **⚠ Known debt**: PKs are `cuid()` — migrate to `uuid()` in Phase 1b

### Phase 1a — Monorepo Restructure _(NEXT)_

- Install Turborepo at root
- Move Next.js app → `apps/web/`
- Extract `packages/database/` (Prisma), `packages/types/`, `packages/auth/`
- Verify dev/build/test pipeline from root

### Phase 1b — Schema Sync-Readiness _(NEXT, immediately after 1a)_

- Migrate all PKs from `cuid()` → `uuid()` (`@default(uuid()) @db.Uuid`)
- Add `deletedAt DateTime?` to `Organization` and all future domain models
- Add `lastModifiedBy String?`, `lastModifiedDevice String?` to all mutable domain models
- All future queries filter `deletedAt: null` by default in `TenantScopedRepository`
- Re-run `prisma migrate dev --name sync-readiness` + reseed

### Phase 1c — Identity (original Phase 1)

- Prisma: `User`, `Role`, `Department`, `UserInvitation`, `AuditLog`, `Notification`
- All new models: UUID PKs + `deletedAt` + `lastModifiedBy` from the start
- Permission slugs + `hasPermission()` + `requirePermission()` middleware + `usePermission()` hook
- Roles & Permissions UI with custom role builder
- User management: invite, edit, suspend, bulk actions
- Department CRUD with nested tree
- Full branding customization (logo, colors, fonts, live preview)
- Audit log viewer, notification bell, profile + MFA

### Phase 2 — Business Entities

- Prisma: `Distributor`, `Client`, `Product`, `Warehouse`, `InventoryStock`, `InventoryTransaction` — all with UUID PKs + soft deletes
- pgvector column on `Product` (used in Phase 6 AI)
- Distributors + Clients: full CRUD, bulk import/export CSV/Excel, auto-generated codes
- Product catalog: SKU, barcode, images, categories, pricing
- Warehouse & inventory: stock levels, adjustments, transfers, stock-take
- Reusable `<DataTable>`, `<FilterPanel>`, `<FileUploader>` components

### Phase 3 — DSR & Invoicing

- Prisma: `DSREntry`, `DSRLineItem`, `Invoice`, `InvoiceLineItem`, `Payment`, `PaymentReminder`, `SalesTarget`, `PerformanceSnapshot` — all UUID PKs + soft deletes
- DSR submission (sales rep), approval/rejection (manager), atomic transaction on approval
- **Offline rule**: DSRs can be submitted offline (queued); invoice numbering is server-side only
- Invoice template builder (visual, live preview)
- Invoice lifecycle: Draft → Issued → Partially Paid → Paid / Overdue / Cancelled
- PDF generation, email sending, open tracking
- Payment recording (partial allowed) — requires online
- Auto payment reminders via BullMQ cron
- Sales targets with progress tracking

### Phase 4 — Dashboards (11 total)

- Shared widget library: `<KPICard>`, `<LineChartCard>`, `<BarChartCard>`, `<DonutChartCard>`, `<GaugeWidget>`, `<MapWidget>`, `<Leaderboard>`
- 11 dashboards: Super Admin, Tenant Executive, Sales, Distributors, Single Distributor, Clients, Inventory, Financial, EPR, Per-Employee, Manager, Sales Rep
- Aggregation API endpoints with Redis caching (5 min TTL)
- Materialized views refreshed nightly
- Drag-and-drop widget customization (dnd-kit), saved per user
- Export: CSV, Excel, PDF

### Phase 5 — Platform Billing

- Subscription plans: Starter, Pro, Business, Enterprise
- Tenant self-service billing page
- Token top-up packs + auto-top-up
- Monthly platform invoicing via BullMQ cron
- Payment providers: Stripe + Manual (+ optional JazzCash/EasyPaisa)
- Subscription lifecycle enforcement: trial → paid → past-due → suspended → cancelled
- Coupons & promotions
- Super Admin revenue dashboards (MRR, ARR, cohort, churn)

### Phase 6 — AI Intelligence Layer

- Prisma: `OrganizationAISettings`, `AIRecommendation`, `AIConversation`, `AIInsight`, `TokenWallet`, `TokenUsageLog`
- AI provider abstraction: `IAIProvider` → Claude, OpenAI, Gemini, Ollama implementations
- Token wallet: usage tracking, budget enforcement, auto-top-up
- Nightly inventory demand prediction, daily dormant client detection
- Payment behavior scoring (0–100), anomaly detection every 6 hours
- AI chat assistant: streaming, tool-calling, RAG with pgvector
- Smart target suggestions, upsell/cross-sell via product embeddings
- Natural language report summaries (cached 1 hour)

### Phase 7 — Polish & Launch (Web)

- Performance: Lighthouse >90, <3s TTI, fix N+1 queries, Redis caching
- Accessibility: WCAG 2.1 AA
- Security: tenant isolation tests, rate limiting, CSP, PII encryption
- Error handling: Sentry, global error boundary, friendly error pages
- i18n: next-intl (English default, RTL-ready for Urdu)
- Monitoring: Sentry + PostHog + UptimeRobot + BullMQ alerts
- Public landing page + pricing + docs + legal pages
- Deployment: Vercel + Neon + Upstash + R2 + Resend + custom domain
- **PWA mode** at end of Phase 7 (offline-ish web, free, proves sync viability)

### Phase 8 — Mobile App (Expo + PowerSync)

- `apps/mobile/` Expo React Native app
- PowerSync integration: `packages/sync/` with PostgreSQL CDC config
- SQLite local database per device, selective sync by org + user
- Screens: DSR submission, client list, product catalog, dashboard KPIs
- Mobile-only: camera evidence, GPS capture, barcode scan, biometric auth, push notifications
- EAS Build pipeline for iOS + Android

### Phase 9 — Desktop App (Tauri)

- `apps/desktop/` Tauri 2.0 shell wrapping the Next.js web build
- Auto-updater, code signing (macOS + Windows)
- Desktop-only: keyboard shortcuts, multi-window, system tray, native file drag
- GitHub Releases distribution

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
