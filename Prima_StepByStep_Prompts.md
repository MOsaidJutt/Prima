# Prima — Step-by-Step Build Prompts

> Feed these to your AI coding tool (Claude Code, Cursor, Bolt, v0, etc.) **one phase at a time**. Wait for each phase to complete and review before moving to the next. Each prompt is self-contained but references the master prompt for full context.

---

## HOW TO USE THIS DOCUMENT

1. **First, share the Master Prompt file (`Prima_Master_Prompt.md`) with the AI tool** as a permanent reference document or system prompt. Tell it: *"This is the full specification. Keep it in mind for every phase."*
2. **Then feed Phase 0 below.** Wait for completion.
3. **Review the output.** Test what was built. Fix any issues before moving on.
4. **Feed Phase 1.** Repeat.
5. Each phase builds on previous phases, so order matters.

---

## PHASE 0 — FOUNDATION & MULTI-TENANCY

**Goal:** Get the project running with auth, multi-tenancy, and super admin bootstrap.

**Estimated time for AI tool:** 1–2 sessions.

### Prompt:

```
We are building Prima, an intelligent multi-tenant Daily Sales Reporting (DSR) SaaS 
platform. You have the full master specification document for reference.

For this phase (Phase 0 — Foundation), build only the following:

1. PROJECT SETUP
   - Initialize a Next.js 15 project with TypeScript (strict mode), App Router, Tailwind CSS v4
   - Install and configure: Prisma 6, shadcn/ui, Zod, React Hook Form, Lucide icons
   - Set up ESLint, Prettier, Husky pre-commit hooks
   - Create a `.env.example` with every variable we will need
   - Add a `docker-compose.yml` for local PostgreSQL 16 (with pgvector extension) and Redis
   - Configure absolute imports with `@/` prefix

2. DATABASE FOUNDATION
   - Create `prisma/schema.prisma` with ONLY these models for now:
     * SuperAdmin (with role enum: OWNER, SUB_ADMIN; permissions JSON array)
     * PlatformSettings
     * PlatformAuditLog
     * Organization (full schema as per master spec, including branding fields, 
       subscription fields, AI fields)
     * OrganizationInvoice (platform-level invoices to tenants)
     * UserSession
   - Add the pgvector extension setup
   - Generate Prisma client
   - Create a seed script that creates: 1 Super Admin owner, default PlatformSettings, 
     and 2 demo organizations (one on trial, one active)

3. AUTHENTICATION
   - Set up Better Auth (or NextAuth v5 if Better Auth is unfamiliar)
   - Implement: login, logout, password reset, email verification
   - Separate auth flows for Super Admin (at /super-admin/login) and Tenant users 
     (at /login)
   - JWT with refresh tokens, 24h inactive timeout
   - Bcrypt password hashing (12 rounds)
   - Build a session middleware that attaches user + organizationId to every request

4. MULTI-TENANCY MIDDLEWARE
   - Create `lib/tenant-context.ts` with a TenantContext that gets organizationId 
     from the authenticated user
   - Create a `TenantScopedRepository` base class (or Prisma extension) that 
     automatically adds `organizationId` filter to all queries
   - Every Prisma query in the app MUST go through this — write a developer doc 
     explaining the pattern
   - Subdomain routing: middleware that maps `{slug}.localhost:3000` to the 
     correct Organization

5. SUPER ADMIN PANEL (BASIC)
   - Route group: /super-admin/*
   - Pages:
     * /super-admin/login
     * /super-admin/dashboard (just placeholder cards for now)
     * /super-admin/organizations (list with search, status badges, create button)
     * /super-admin/organizations/new (form to create a new tenant)
     * /super-admin/organizations/[id] (detail page with edit, suspend, delete actions)
     * /super-admin/admins (list of Super Admins and Sub-Admins, create new)
     * /super-admin/settings (platform settings: pricing, branding)
   - Owner can create Sub-Super Admins with scoped permissions
   - Every Super Admin action writes to PlatformAuditLog

6. ORGANIZATION ONBOARDING
   - When Super Admin creates an Organization, send invitation email to the Tenant 
     Admin email
   - Tenant Admin clicks link → sets password → lands on /onboarding
   - Onboarding wizard (4 steps): Organization profile → Branding (logo, colors) → 
     First department → Invite team
   - After onboarding, redirect to /admin (placeholder dashboard for now)

7. UI FOUNDATIONS
   - Install shadcn/ui components: button, input, card, dialog, dropdown-menu, 
     table, badge, toast, form
   - Build a shared <DashboardLayout> with sidebar navigation (role-aware)
   - Theme provider with light/dark mode toggle (persist to user.preferences)
   - Toast notifications wired up

8. TESTING
   - Set up Vitest for unit tests
   - Set up Playwright for E2E tests
   - Write E2E tests for: Super Admin login, create organization, tenant 
     onboarding flow

DELIVERABLES:
- Running Next.js app at localhost:3000
- Super Admin can log in at /super-admin/login (email/password from seed)
- Super Admin can create an organization
- Created tenant admin gets email, sets password, completes onboarding
- Dark mode works
- All E2E tests pass

DO NOT BUILD YET:
- Roles & permissions UI (Phase 1)
- Departments, users beyond admin (Phase 1)
- Distributors, clients, products (Phase 2)
- DSR, invoicing (Phase 3)
- Dashboards (Phase 4)
- AI features (Phase 5)

When complete, summarize what was built, show the project tree, and list any 
deviations from the spec with justification.
```

---

## PHASE 1 — IDENTITY: USERS, ROLES, DEPARTMENTS, BRANDING

**Goal:** Tenant Admin can fully manage their team, permissions, and visual identity.

### Prompt:

```
Phase 1 of Prima. Build on Phase 0. Reference the master specification.

Build the following:

1. EXPAND PRISMA SCHEMA
   - Add models: User, Role, Department, UserInvitation, AuditLog, Notification, 
     ActivityFeed, InvoiceTemplate (just the structure, full invoicing in Phase 3)
   - Run migration
   - Update seed: create default roles (Owner, Manager, Sales Rep, Accountant, Viewer) 
     per organization with proper permission slugs

2. PERMISSION SYSTEM
   - Create `lib/permissions.ts` with all permission slugs grouped by module 
     (from master spec Section 7)
   - Build a `hasPermission(user, slug)` helper
   - Create middleware `requirePermission(slug)` for API routes
   - Create React hook `usePermission(slug)` for conditional UI rendering
   - Build a `<PermissionGate slug="...">` wrapper component

3. ROLES & PERMISSIONS UI
   - /admin/settings/roles — list all roles with member count
   - /admin/settings/roles/new — create custom role with permission checkboxes 
     grouped by module
   - /admin/settings/roles/[id] — edit role permissions
   - System roles (Owner, Manager, etc.) are read-only by default
   - Custom roles can be created, edited, deleted (cannot delete if users assigned)

4. USER MANAGEMENT
   - /admin/users — table of users with name, email, role, department, status, 
     last active
   - Filters: by role, department, status
   - Bulk actions: deactivate, change role
   - /admin/users/new — invite user (email, role, department)
   - /admin/users/[id] — user detail with edit, suspend, delete (soft), reset password
   - Invitation email with magic link (Resend + React Email)
   - When user accepts: set password, land on dashboard

5. DEPARTMENTS
   - /admin/settings/departments — CRUD UI for departments
   - Each department can have a manager (User with appropriate role)
   - Support nested departments (parent_id)
   - Tree view + flat list toggle

6. BRANDING & CUSTOMIZATION
   - /admin/settings/branding — full visual customization page
   - Logo upload (light + dark variants), favicon
   - Color picker for primary, secondary, accent
   - Font family dropdown (Google Fonts list, 20 popular options)
   - Live preview pane showing sample dashboard with new branding
   - On save, regenerate theme tokens and apply throughout app
   - Email template branding (header banner image, footer text)
   - Login page customization

7. ORGANIZATION SETTINGS
   - /admin/settings/organization — name, address, contact, NTN, STRN, 
     currency, locale, timezone, fiscal year start, date format

8. AUDIT LOG VIEWER
   - /admin/settings/audit-log — paginated, filterable log of all mutations
   - Filters: user, action, entity, date range
   - Show old vs new value diff

9. NOTIFICATIONS
   - Notification bell in top nav (with unread count)
   - Dropdown shows recent notifications
   - Full page at /admin/notifications
   - Notification types: user_invited, role_changed, department_assigned

10. PROFILE & PREFERENCES
    - /admin/profile — user's own profile (any role)
    - Change password, enable MFA (TOTP), update avatar
    - Notification preferences (email, in-app)
    - Theme preference (light/dark/system)

DELIVERABLES:
- Tenant Admin can fully manage users, roles, departments, branding
- Permission system enforced on every API route and UI element
- Audit log captures every change
- Custom branding applied across the app

E2E TESTS:
- Tenant Admin creates a custom role with specific permissions
- Tenant Admin invites a user with that role
- User accepts invite, logs in, sees only their permitted UI
- Tenant Admin changes branding, new colors appear after refresh

When complete, summarize and list any deviations.
```

---

## PHASE 2 — BUSINESS ENTITIES: DISTRIBUTORS, CLIENTS, PRODUCTS, INVENTORY

**Goal:** Core data the business runs on.

### Prompt:

```
Phase 2 of Prima. Build on Phases 0 and 1. Reference the master specification.

Build the following:

1. EXPAND PRISMA SCHEMA
   - Add models: Distributor, Client, Product, Warehouse, InventoryStock, 
     InventoryTransaction
   - Add pgvector column on Product for AI similarity (we will use it in Phase 5; 
     just create the column for now)
   - Migrate and update seed

2. DISTRIBUTORS MODULE
   - /admin/distributors — table with code, name, contact, city, status, balance, 
     rating
   - Bulk import from CSV/Excel with column mapping wizard
   - Bulk export to Excel
   - Search (debounced, server-side), filters (city, status, tier)
   - /admin/distributors/new — full form with all fields from master spec 
     (company info, contact, address with optional geo, tax IDs, bank details, 
     credit limit, payment terms, status, tags, notes, attachments)
   - /admin/distributors/[id] — detail page with tabs: Overview, Clients (linked), 
     Transactions, Payment History, Notes, Attachments, Activity
   - /admin/distributors/[id]/edit
   - Auto-generated codes (e.g. DST-0001) per organization

3. CLIENTS MODULE
   - Same structure as distributors
   - Additional: linked distributor (optional dropdown), assigned sales rep, 
     business type, business size, industry
   - Auto-calculate fields: total lifetime value, average order value, first/last 
     order dates, total orders (placeholders for now, will compute in Phase 3)
   - Tabs on detail page: Overview, Orders, Invoices, Payments, Notes, Activity

4. PRODUCT CATALOG
   - /admin/products — table with SKU, name, category, price, stock level, status
   - /admin/products/new — full form: SKU (auto or manual), barcode, name, 
     description, category (with autocomplete), brand, unit of measure, pack 
     size, cost price, selling price, MRP, tax rate, images (multi-upload), 
     reorder level, status
   - Bulk import/export
   - Image upload to R2/S3 with auto-thumbnail generation
   - Category management as a sub-page

5. WAREHOUSE & INVENTORY
   - /admin/inventory/warehouses — CRUD for warehouses
   - /admin/inventory — stock levels view (product x warehouse matrix)
   - /admin/inventory/transactions — full history of stock movements
   - /admin/inventory/adjust — manual adjustment with reason
   - /admin/inventory/transfer — transfer between warehouses
   - /admin/inventory/stock-take — physical count workflow with variance report
   - Low-stock alerts (when quantity <= reorder_level) shown as notifications

6. CLIENT INTELLIGENCE (BASIC, NON-AI VERSION)
   - On client detail page, show:
     * Payment behavior score (placeholder 0-100, will be computed in Phase 5)
     * Last order date with days-ago indicator
     * Churn risk badge (placeholder)
     * Lifetime value, average order value (placeholders)
   - These will be computed after Phase 3 (when invoices and payments exist)

7. SHARED COMPONENTS
   - Build reusable <DataTable> with: sorting, filtering, pagination, column 
     visibility, row selection, bulk actions, CSV/Excel export
   - <FilterPanel> with date range, multi-select, search
   - <EntityCard> for distributor/client/product preview cards
   - <AddressInput> with autocomplete (optional Google Places integration)
   - <FileUploader> for attachments (drag-drop, multi-file, type validation)

DELIVERABLES:
- Full CRUD on distributors, clients, products, warehouses
- Inventory tracking working (manual adjustments + transactions)
- Bulk import/export working
- Image and file uploads working with R2/S3
- All access gated by permissions from Phase 1

E2E TESTS:
- Create a distributor with full details, verify it appears in list
- Bulk import 100 clients from CSV
- Adjust stock for a product, verify transaction logged
- Transfer stock between warehouses, verify both warehouses update

When complete, summarize and list any deviations.
```

---

## PHASE 3 — DSR & INVOICING

**Goal:** The core operational workflow — sales reps log activity, invoices flow, payments come in.

### Prompt:

```
Phase 3 of Prima. Build on Phases 0–2. Reference the master specification.

Build the following:

1. EXPAND PRISMA SCHEMA
   - Add models: DSREntry, DSRLineItem, Invoice, InvoiceLineItem, Payment, 
     PaymentReminder, SalesTarget, PerformanceSnapshot
   - Migrate and update seed (generate 90 days of historical DSR + invoice + 
     payment data for demo tenants)

2. DSR SUBMISSION (SALES REP VIEW)
   - /dashboard (sales rep landing)
   - /dashboard/dsr/new — form to submit a daily sales report
     * Select client (searchable dropdown with recent clients pinned)
     * Visit type (in person, phone, virtual, email)
     * Visit notes, outcome, follow-up date
     * Customer satisfaction (1-5 stars)
     * Optional: geo location (browser geolocation API)
     * Line items: add multiple products with quantity, unit price (autofill 
       from product), discount (% or flat), tax (auto from product)
     * Live total calculation
     * Save as draft OR submit
   - /dashboard/dsr — list of own DSR entries with status badges
   - /dashboard/dsr/[id] — view (read-only if submitted)
   - /dashboard/dsr/[id]/edit (only if status is DRAFT)
   - Soft delete drafts

3. DSR APPROVAL (MANAGER VIEW)
   - /manager/dsr/pending — queue of submitted DSRs from team members
   - Each row: submitter, client, date, total, view button
   - View page: full DSR details + approve/reject buttons
   - Reject requires a reason (textarea)
   - Approval triggers: inventory deduction, invoice draft creation (optional 
     toggle per organization)
   - All in a single database transaction

4. INVOICE TEMPLATE BUILDER
   - /admin/settings/invoice-templates — list templates
   - /admin/settings/invoice-templates/new — visual template editor
     * Header HTML (logo position, company info)
     * Footer HTML (terms, signature)
     * Logo upload (different from org logo)
     * Color customization
     * Bank details block (toggleable)
     * Tax label (GST / VAT / Sales Tax / Custom)
     * Invoice number format (prefix + padding, e.g. ACME-INV-{YYYY}-{0000})
     * Live preview pane with sample data
   - Set as default
   - Multiple templates supported (e.g. one for export, one for local)

5. INVOICE MANAGEMENT
   - /admin/invoices — main invoice list with status tabs (All, Draft, Issued, 
     Partially Paid, Paid, Overdue, Cancelled)
   - /admin/invoices/new — create from scratch
     * Select client, distributor (optional)
     * Select template
     * Add line items (or import from approved DSR)
     * Issue date, due date (auto from client's payment terms)
     * Subtotal, tax, discount, shipping → grand total auto-calculated
     * Save as draft or issue
   - /admin/invoices/[id] — invoice view
     * Full preview as PDF (server-rendered via react-pdf or puppeteer)
     * Actions: Edit (only drafts), Issue (draft → issued), Send via email, 
       Record payment, Duplicate, Cancel, Download PDF
     * Activity timeline (issued, viewed, payment recorded, etc.)
   - Email sending via Resend with React Email template
   - Track when invoice is opened (tracking pixel)
   - Auto-mark OVERDUE on cron job (daily) when past due date

6. PAYMENT RECORDING
   - On invoice detail, "Record Payment" button
   - Modal with: amount, date, method (cash/bank/cheque/card/wallet/other), 
     reference number, optional bank/cheque details, attachment (receipt photo), 
     notes
   - Partial payments allowed; status auto-updates to PARTIALLY_PAID or PAID
   - On payment recorded:
     * Update client's payment_behavior fields (will refine in Phase 5)
     * Update client's current_balance
     * Trigger AuditLog
     * Send receipt email to client (optional toggle)

7. PAYMENT REMINDERS
   - Auto-generated cron: 3 days before due, on due day, 7/14/30 days after
   - Reminder templates customizable per organization
   - Channels: Email (working now), SMS/WhatsApp (placeholder for Phase 6)
   - Reminder log shows what was sent and when

8. PENDING vs PAID VIEWS
   - /admin/invoices/pending — sortable by overdue days, total outstanding
   - /admin/invoices/paid — full payment history
   - /admin/invoices/overdue — auto-filter
   - Aging report: 0-30, 31-60, 61-90, 90+ days

9. CLIENT FINANCIAL SUMMARY
   - On client detail page, "Financials" tab:
     * All invoices for this client
     * Payment history
     * Current outstanding balance
     * Credit limit utilization (bar)
     * Total lifetime value (now actually computed)
     * Average order value (computed)
     * Average days-to-pay (computed from payments)

10. TARGETS
    - /admin/targets — list and create targets
    - Scope: Organization / Department / User / Product / Client
    - Type: Revenue / Units / Visits / New Clients / Collections
    - Period: Daily / Weekly / Monthly / Quarterly / Yearly / Custom
    - Auto-update achieved value from DSR + invoice data
    - Show progress bars

11. BACKGROUND JOBS (BullMQ + Redis)
    - Set up BullMQ for: invoice overdue marking, payment reminders, performance 
      snapshots (daily), email sending
    - Admin can see job queue health

DELIVERABLES:
- Sales reps submit DSRs end-to-end
- Managers approve/reject
- Invoices generate from DSRs OR manually
- PDF invoices downloadable and emailable
- Payments recorded; balance auto-updates
- Targets tracked

E2E TESTS:
- Sales rep submits DSR, manager approves, invoice auto-created, payment recorded, 
  status transitions correctly
- Generate PDF and verify branding applied
- Test partial payment flow
- Test overdue auto-marking

When complete, summarize and list any deviations.
```

---

## PHASE 4 — DASHBOARDS (ALL 11)

**Goal:** Multiple professional dashboards for every role.

### Prompt:

```
Phase 4 of Prima. Build on Phases 0–3. Reference master specification Section 10.

Build all 11 dashboards listed in the master spec. Each dashboard is a separate 
page with role-based access.

1. SHARED WIDGET LIBRARY (BUILD FIRST)
   - <KPICard> with value, label, trend %, icon, color
   - <LineChartCard>, <BarChartCard>, <DonutChartCard>, <AreaChartCard> using Recharts
   - <Leaderboard> with rank, avatar, name, value, trend
   - <DataTableWidget> for embedded tables
   - <GaugeWidget> for target achievement
   - <MapWidget> for geo data (use Leaflet/OpenStreetMap, free)
   - <AIInsightsCard> (placeholder UI for Phase 5)
   - <FilterBar> shared across all dashboards with date range, department, user, 
     product category filters

2. DASHBOARD PAGES (BUILD EACH)
   - /super-admin/dashboard — Super Admin platform-wide
   - /admin — Tenant Admin Executive (default home)
   - /admin/dashboards/sales — Sales Dashboard
   - /admin/dashboards/distributors — Distributor overview
   - /admin/distributors/[id]/dashboard — Single Distributor deep-dive
   - /admin/dashboards/clients — Client overview
   - /admin/dashboards/inventory — Inventory & stock
   - /admin/dashboards/financial — Financial / cash flow
   - /admin/dashboards/epr — Employee Performance Reports
   - /admin/dashboards/epr/[userId] — Per-employee detail
   - /manager — Manager team dashboard
   - /dashboard — Sales Rep personal dashboard

   Each dashboard MUST include exactly the widgets specified in master spec 
   Section 10. Do not skip widgets.

3. DATA AGGREGATION ENDPOINTS
   - /api/v1/dashboards/super-admin
   - /api/v1/dashboards/executive
   - /api/v1/dashboards/sales
   - /api/v1/dashboards/distributors
   - /api/v1/dashboards/distributor/[id]
   - /api/v1/dashboards/clients
   - /api/v1/dashboards/inventory
   - /api/v1/dashboards/financial
   - /api/v1/dashboards/epr
   - /api/v1/dashboards/epr/[userId]
   - /api/v1/dashboards/manager
   - /api/v1/dashboards/rep
   
   Each accepts filters (date range, etc.). Use Redis caching (5 min TTL).
   For aggregations, prefer Prisma raw SQL with proper indexes over N+1 queries.

4. PERFORMANCE OPTIMIZATION
   - Add indexes on: organizationId, reportDate, status, clientId, userId, 
     departmentId on the relevant tables
   - Create materialized views for: daily revenue, monthly performance per user
   - Refresh materialized views nightly via BullMQ job

5. EXPORT FUNCTIONALITY
   - Every dashboard has "Export" button: CSV, Excel, PDF (snapshot of current view)
   - PDF export uses react-pdf with current branding

6. DASHBOARD CUSTOMIZATION (PER USER)
   - User can rearrange widgets via drag-and-drop (use dnd-kit)
   - User can hide widgets they do not care about
   - Saved per user in user.preferences JSON

DELIVERABLES:
- All 11 dashboards live, working with real data, beautiful UI
- Filters work end-to-end
- Loading skeletons everywhere
- Mobile-responsive (test on viewport widths 375px, 768px, 1280px)
- Dashboards load in <2 seconds for organizations with 100K+ records

E2E TESTS:
- Admin sees executive dashboard with all widgets populated
- Filter by date range, data updates
- Export to PDF works
- Sales rep sees only their own data on /dashboard
- Manager sees team data on /manager
- Drag widget to new position, refresh page, position persists

When complete, summarize and list any deviations.
```

---

## PHASE 5 — AI INTELLIGENCE LAYER

**Goal:** Make Prima genuinely intelligent. The differentiator.

### Prompt:

```
Phase 5 of Prima. Build on Phases 0–4. Reference master specification Section 9.

Build the AI intelligence layer with model-agnostic provider support.

1. EXPAND PRISMA SCHEMA
   - Add models: OrganizationAISettings, AIRecommendation, AIConversation, AIInsight
   - Update Organization with aiEnabled, aiProvider, aiApiKeyEncrypted, aiModel, 
     embeddingProvider, monthlyTokenBudget, monthlyTokensUsed
   - Add TokenWallet, TokenTopUpPack, TokenUsageLog models for the wallet system

2. AI PROVIDER ABSTRACTION
   - Create lib/ai/providers/ with:
     * IAIProvider interface (chat, stream, embed, toolCall methods)
     * ClaudeProvider (using @anthropic-ai/sdk)
     * OpenAIProvider (using openai sdk)
     * GeminiProvider (using @google/generative-ai)
     * OllamaProvider (for local self-hosted)
   - Use Vercel AI SDK (ai package) for unified streaming + tool calling
   - Factory: getAIProvider(org) returns the right provider based on 
     OrganizationAISettings
   - API keys encrypted at rest using AES-256-GCM with master key from env

3. TOKEN WALLET & USAGE TRACKING
   - Every AI call logged to TokenUsageLog (org, user, feature, model, input/output 
     tokens, cost, timestamp)
   - Decrement monthlyTokensUsed counter
   - When usage >= monthlyTokenBudget:
     * If autoTopUpEnabled: charge default pack
     * Else: disable AI features, notify admin
   - Per-user quotas (optional, advanced setting)

4. AI SETTINGS UI
   - /admin/settings/ai — page to configure
     * Toggle AI on/off (gated by plan)
     * Select provider (Claude, OpenAI, Gemini, Local)
     * Paste API key (validated on save by making a test call)
     * Select model from provider's available models
     * Set monthly token budget
     * Auto-top-up settings
     * Per-user quotas (if Business+ plan)
   - /admin/settings/ai/usage — usage dashboard
     * Tokens used this month with progress bar
     * Cost breakdown by feature
     * Cost breakdown by user (if per-user quotas)
     * Historical usage chart
     * Estimated days remaining

5. INVENTORY DEMAND PREDICTION
   - BullMQ job: runs nightly per organization
   - For each product with at least 60 days of sales history:
     * Statistical forecast using simple-statistics or a Prophet-like JS lib
     * 30/60/90-day demand projection
     * Identify seasonality, trend, recent velocity
     * Calculate recommended reorder date and quantity
     * Calculate stockout risk date
     * LLM call (Haiku) to generate 2-sentence plain-language explanation
     * Save to InventoryPrediction table
   - Surface on /admin/dashboards/inventory:
     * "AI-Recommended Reorders" table with approve button
     * Traffic-light indicators on each product row
     * "Stockout risk in 7 days" alerts

6. DORMANT CLIENT DETECTION
   - BullMQ job: runs daily
   - For each client:
     * Calculate average gap between orders historically
     * Calculate current days since last order
     * If current_gap > 2x average_gap AND lifetime_value > organization_average:
       create AIRecommendation of type DORMANT_CLIENT
     * Include suggested re-engagement action and the client's value
   - Surface as cards on Executive Dashboard and to assigned sales rep
   - Mark as dismissed or acted-on

7. PAYMENT BEHAVIOR SCORING
   - Trigger: after every payment recorded
   - For affected client, recalculate:
     * On-time payment percentage (40% weight)
     * Average days late (30%)
     * Number of defaults (20%)
     * Recent trend (10%)
   - Score 0-100 → label EXCELLENT / GOOD / AVERAGE / RISKY / DEFAULTER
   - Update client.paymentBehaviorScore and paymentBehaviorLabel
   - Show as colored badge on client cards everywhere
   - Tooltip explains the factors

8. ANOMALY DETECTION
   - BullMQ job: runs every 6 hours
   - Detect:
     * Department revenue dropped >25% week-over-week
     * Sales rep skipped DSR submissions for 3+ days
     * Product velocity changed >30%
     * Single client's order suddenly 3x their average (potential mistake)
   - Create AIRecommendation entries with severity
   - Push notifications to relevant admins

9. AI CHAT ASSISTANT
   - Floating chat panel in admin dashboard (sticky bottom-right)
   - /admin/ai-assistant — full-page chat interface
   - Streaming responses
   - Tool-calling enabled: AI can query the org's data via predefined tools:
     * get_revenue(period, breakdown)
     * get_top_clients(limit, by)
     * get_inventory_status(category)
     * get_overdue_invoices()
     * get_employee_performance(userId, period)
   - RAG over org's own data using pgvector:
     * Embed product descriptions, client notes, DSR notes
     * On chat query, retrieve top-k relevant chunks as context
   - Conversation history saved per user

10. SMART TARGETING
    - When admin creates a target, "Get AI Suggestion" button
    - AI analyzes historical data and suggests an achievable target with rationale
    - Flag clearly unrealistic targets (e.g. 300% YoY growth) with warning

11. UPSELL & CROSS-SELL
    - On client detail page, "Suggested Products" tab
    - Use vector similarity: find products bought by similar clients (collaborative 
      filtering via product embeddings)
    - Show top 5 with rationale

12. NATURAL LANGUAGE REPORT SUMMARIES
    - Every dashboard widget has "Summarize" button
    - AI reads the chart data and writes a 3-sentence narrative
    - Cached for 1 hour

13. AI RECOMMENDATIONS FEED
    - /admin/recommendations — central feed of all active AI recommendations
    - Filter by type, severity
    - Acknowledge, dismiss, act-on actions
    - Notifications when new critical recommendation arrives

DELIVERABLES:
- Model-agnostic AI layer that works with Claude, OpenAI, Gemini, Ollama
- Token wallet enforces budgets and supports auto-top-up
- Inventory predictions running nightly
- Dormant client + payment scoring + anomaly detection active
- AI chat assistant with RAG and tool-calling
- All AI features gated by plan and token budget

E2E TESTS:
- Admin pastes API key, validates successfully
- Generate inventory predictions, verify they appear on dashboard
- Trigger dormant client detection with test data, verify recommendation created
- Chat assistant answers "what was last month's revenue?" correctly
- When token budget exceeded, AI features disabled and admin notified

When complete, summarize and list any deviations. Document the AI provider 
interface so additional providers can be added easily.
```

---

## PHASE 6 — PLATFORM BILLING & SUBSCRIPTIONS

**Goal:** Super Admin can monetize. Tenants pay, upgrade, top-up tokens.

### Prompt:

```
Phase 6 of Prima. Build on Phases 0–5. Reference Pricing Strategy document.

Build the platform-level billing system.

1. EXPAND PRISMA SCHEMA
   - Confirm models from Pricing doc: TokenWallet, TokenTopUpPack, TokenTopUpOrder
   - Add SubscriptionPlan model (Starter, Pro, Business, Enterprise) with features 
     and pricing
   - Add PaymentMethod model (tenant's saved methods for auto-top-up)
   - Add platform-level Coupon and Promotion models

2. SUBSCRIPTION MANAGEMENT (SUPER ADMIN)
   - /super-admin/plans — manage subscription plans (price, features, limits)
   - /super-admin/organizations/[id]/billing — view and modify a tenant's:
     * Current plan
     * Subscription status
     * Setup fee status
     * Next billing date
     * Custom pricing override
   - Pro-rated billing on mid-cycle plan changes

3. TENANT SELF-SERVICE BILLING
   - /admin/billing — tenant's billing page
     * Current plan summary
     * Upgrade / downgrade buttons (with comparison table)
     * Payment method on file
     * Token wallet balance with usage chart
     * Top-up packs available for purchase
     * Auto-top-up toggle
     * Per-user quota settings (Business+ only)
     * Billing history (all platform invoices)
     * Download invoices

4. TOKEN WALLET UI
   - Big balance card showing current token balance
   - "Buy More Tokens" button → modal with pack options
   - Usage history graph (last 30/90/365 days)
   - Auto-top-up: "When my balance drops below X, automatically buy pack Y"
   - Notifications: 80% used, 95% used, exhausted

5. PER-USER TOKEN QUOTAS (BUSINESS+ FEATURE)
   - In /admin/users/[id], if Business+ plan: "AI Token Quota" section
   - Set monthly limit for this user
   - Show their usage vs quota
   - User sees their own quota on /admin/profile

6. PLATFORM INVOICING
   - BullMQ monthly cron: generate platform invoice for each tenant
   - Includes: monthly subscription fee + setup fee (first month) + top-ups consumed
   - PDF generated using Prima's own branding (not tenant's branding)
   - Emailed to tenant billing contact
   - Stored as OrganizationInvoice (already in schema from Phase 0)

7. PAYMENT INTEGRATION (PHASE-FRIENDLY)
   - Build provider abstraction: IPaymentProvider
   - Implement at minimum:
     * ManualPaymentProvider (admin records payment from bank transfer)
     * StripeProvider (international cards)
     * Optional: JazzCashProvider, EasyPaisaProvider for Pakistan local payments
   - Save card via Stripe Setup Intent for auto-top-up
   - Webhook handler for payment confirmation

8. SUBSCRIPTION ENFORCEMENT
   - Middleware checks subscription status on every request
   - PAST_DUE: warning banner shown
   - SUSPENDED: read-only mode (no creates/updates), AI disabled
   - CANCELLED: only billing page accessible
   - 30-day grace before data deletion (with daily email reminders)

9. FREE TRIAL
   - 14 days, no card required
   - Trial banner with days remaining
   - Convert prompt at 7 days, 3 days, 1 day, last day
   - Tenant Admin can convert anytime by adding payment method and selecting plan

10. COUPONS & PROMOTIONS
    - Super Admin can create coupons (% or flat discount, setup fee waiver, 
      bonus tokens)
    - Tenants apply at checkout
    - Track coupon usage for analytics

11. REVENUE DASHBOARDS (SUPER ADMIN)
    - /super-admin/revenue — MRR, ARR charts
    - Cohort analysis (retention by signup month)
    - Churn rate
    - LTV (lifetime value) estimates
    - Conversion funnel: trial → paid

DELIVERABLES:
- Full self-service billing for tenants
- Token wallet with top-ups working
- Auto-top-up working
- Monthly invoicing automated
- At least Stripe + Manual payment providers working
- Subscription lifecycle (trial → paid → suspended → cancelled) enforced

E2E TESTS:
- New tenant goes through trial → upgrade → token top-up flow
- Failed payment triggers warning → 7 days later: feature restriction → 14 days: 
  suspension
- Token wallet auto-top-up triggered at threshold
- Plan downgrade pro-rates correctly

When complete, summarize and list any deviations.
```

---

## PHASE 7 — POLISH & LAUNCH PREP

**Goal:** Production-ready. Tested. Documented. Deployable.

### Prompt:

```
Phase 7 of Prima. Final phase. Build on Phases 0–6.

This phase is about quality, not new features.

1. PERFORMANCE AUDIT
   - Lighthouse score >90 on all pages
   - Time-to-interactive <3s on dashboards with 100K records
   - Identify and fix all N+1 query patterns
   - Add missing database indexes
   - Implement Redis caching on all aggregation endpoints
   - Image optimization (next/image everywhere)
   - Code splitting and lazy loading

2. ACCESSIBILITY AUDIT (WCAG 2.1 AA)
   - All interactive elements keyboard-navigable
   - All form fields have labels
   - Color contrast ≥4.5:1 for text
   - Focus indicators visible
   - Screen reader testing with NVDA or VoiceOver
   - Aria labels on all icon-only buttons
   - Skip-to-content link

3. SECURITY HARDENING
   - Run npm audit, fix all high/critical
   - Penetration test checklist:
     * SQL injection: verified all queries use Prisma
     * XSS: verify React escaping everywhere, sanitize rich text
     * CSRF: verify all mutations have CSRF tokens
     * Tenant isolation: write tests that try to access another org's data
     * Auth bypass: try every privilege escalation path
   - Add rate limiting (Upstash rate limit)
   - Add security headers (helmet equivalent for Next.js)
   - Implement CSP (Content Security Policy)
   - Encrypt PII fields at rest (NTN, bank account numbers)

4. ERROR HANDLING
   - Global error boundary catches all React errors
   - All API routes wrapped in try-catch with structured error responses
   - Sentry integration with org context tagging
   - User-friendly error pages: /404, /403, /500
   - Friendly error messages (no stack traces in production)

5. INTERNATIONALIZATION FOUNDATION
   - Set up next-intl with English as default
   - Extract all UI strings to translation files
   - Structure ready for Urdu (RTL support) in future
   - Date and number formatting respects org locale

6. EMAIL DELIVERABILITY
   - Configure SPF, DKIM, DMARC for the sending domain
   - Test all email templates render correctly in Gmail, Outlook, Apple Mail
   - Bounce and complaint handling via Resend webhooks

7. BACKUP & DISASTER RECOVERY
   - Daily automated Postgres backups (Supabase/Neon handles this; verify retention)
   - Document restore procedure
   - Test restore procedure once
   - File storage backed up (R2/S3 versioning enabled)

8. MONITORING & ALERTING
   - Sentry for errors
   - PostHog for product analytics
   - Uptime monitoring (UptimeRobot or BetterStack)
   - Database query performance monitoring
   - BullMQ queue depth alerts
   - On-call alert routing (email + WhatsApp via Resend/Twilio)

9. DOCUMENTATION
   - /docs route in app with:
     * Getting started guide
     * Video tutorials (placeholders OK)
     * Feature documentation
     * FAQ
     * API documentation (auto-generated from Zod schemas)
   - README.md updated with:
     * Architecture overview
     * Local development setup
     * Deployment guide
     * Environment variables explained
   - CONTRIBUTING.md
   - SECURITY.md with vulnerability disclosure process

10. LANDING PAGE & MARKETING SITE
    - /  — public landing page (not app)
      * Hero: "Prima — From raw data to refined decisions"
      * Problem statement
      * 6-8 feature cards with screenshots/illustrations
      * Pricing table (from Pricing Strategy doc)
      * Testimonials placeholder
      * FAQ
      * Footer with links
    - /pricing — detailed pricing page
    - /about
    - /contact
    - /docs (mentioned above)
    - /privacy, /terms — legal pages
    - SEO: proper metadata, OpenGraph, sitemap.xml, robots.txt
    - All static pages SSR'd

11. DEPLOYMENT
    - Vercel project configured
    - Production environment variables documented in vault (1Password / Doppler)
    - Postgres on Neon or Supabase (production tier)
    - Redis on Upstash (production tier)
    - File storage on Cloudflare R2
    - Email on Resend
    - Custom domain configured with SSL
    - Staging environment that mirrors production

12. LAUNCH CHECKLIST
    - All E2E tests passing in CI
    - Lighthouse audit complete
    - Security audit complete
    - Backups verified
    - Monitoring active
    - Documentation complete
    - Marketing site live
    - Stripe / payment providers in live mode
    - First demo organization fully working end-to-end
    - You (as Super Admin) onboarded with real account

DELIVERABLES:
- Production-deployed Prima at your domain
- All systems monitored
- Ready to onboard real customers

When complete, write a final summary covering:
- Total LOC, files, test coverage
- Architecture highlights
- Any technical debt for future
- Suggested next features
- Cost projection at 100 tenants
```

---

## BONUS: TROUBLESHOOTING PROMPT (USE WHEN STUCK)

If the AI tool gets stuck or produces buggy code mid-phase, use this:

```
Pause current work. Run a self-audit:
1. List every file you have created or modified in this phase.
2. For each file, state its purpose in one sentence.
3. Run the test suite. Report any failures.
4. Identify which deliverables from the phase prompt are: 
   COMPLETE / PARTIAL / NOT STARTED.
5. For PARTIAL items, list specific bugs or gaps.
6. Propose a focused plan to finish only the incomplete items.
7. Do not start new work until I confirm the plan.
```

---

## BONUS: REVIEW PROMPT (AFTER EACH PHASE)

After each phase, run this review prompt:

```
Review the current codebase as a senior engineer would.

1. Tenant isolation: pick 3 random API endpoints and verify organizationId 
   scoping is enforced.
2. Permission enforcement: pick 3 random endpoints and verify permission middleware.
3. Audit logging: verify every mutation creates an AuditLog entry.
4. Type safety: report any usage of `any` type with justification.
5. Database performance: identify any N+1 query patterns.
6. Test coverage: report % per module.
7. Security: any obvious vulnerabilities?
8. Code duplication: any patterns repeated 3+ times that should be abstracted?

Output a markdown report. Fix critical issues before next phase.
```

---

## TIPS FOR FEEDING THESE PROMPTS

1. **Always share the Master Prompt and Pricing Strategy as context first.** 
   Most AI tools accept a "system" or "context" document.

2. **Do not skip phases.** Phase 5 (AI) depends heavily on Phase 3 (data). 
   Phase 6 (billing) depends on Phase 5 (token tracking).

3. **Use Claude Code or Cursor for best results** — they handle multi-file 
   generation and project context better than Bolt or single-shot tools.

4. **After each phase, test in a real browser** before moving on. Bugs 
   compound across phases.

5. **Commit to git after each phase.** Tag releases (v0.1, v0.2, etc.) so 
   you can roll back if a phase introduces regressions.

6. **Budget your AI usage too.** Building Prima end-to-end with Claude Code 
   on Sonnet 4.6 will cost roughly $30–80 in API tokens depending on how 
   many iterations you need.

7. **When the AI hallucinates a library or API:** stop, search the actual 
   library docs, paste the real signature back to the AI.

8. **Keep one chat per phase.** When Phase 1 is done, start a fresh chat 
   for Phase 2 with the Master Prompt as context. Long contexts degrade 
   AI quality.
