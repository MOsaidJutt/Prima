# Prima — Multi-Platform Architecture Addendum

This document AMENDS the Master Prompt. Prima is now a multi-platform product:

1. Web application (already in progress, primary)
2. Desktop application (macOS, Windows, Linux)
3. iOS application
4. Android application

All platforms must:

- Share business logic and data model
- Work offline with local data
- Sync automatically when online
- Show identical data across a user's devices

## TECHNOLOGY CHOICES (LOCKED)

### Web (Primary)

- Next.js 15 + TypeScript (as already chosen)
- This is the canonical implementation

### Desktop

- **Tauri 2.0** (NOT Electron)
- Reasons: smaller bundle (~3MB vs Electron's 100MB+), better performance,
  better security, can wrap the same Next.js web build
- Build target: macOS (Apple Silicon + Intel), Windows 10+, Linux (Ubuntu)
- Auto-update via Tauri's built-in updater
- Code-sign builds for distribution

### Mobile (iOS + Android)

- **Expo + React Native** (NOT pure native, NOT Capacitor)
- Reasons: 70%+ code share with web through shared business logic packages,
  EAS Build handles iOS/Android building without owning Macs, OTA updates
  via Expo Updates, mature ecosystem
- Target: iOS 15+, Android 8+
- Push notifications via Expo Push Service

### Sync Engine

- **PowerSync** (https://www.powersync.com/) — PostgreSQL ↔ SQLite sync
- Reasons: production-ready, works with any auth, handles conflicts,
  has Postgres CDC built in, supports React/React Native/web
- Each device gets a local SQLite database
- Two-way sync with conflict resolution (last-write-wins by default,
  customizable per table)
- Selective sync (a device only syncs data the user has access to)

### Backend

- Same Next.js API serves all platforms (REST + JSON)
- Optionally add tRPC for type-safety across all clients
- PostgreSQL primary, with PowerSync layer for sync

## MONOREPO STRUCTURE

Reorganize the codebase as a Turborepo monorepo:
prima/
├── apps/
│ ├── web/ ← Next.js (existing Phase 0 work goes here)
│ ├── desktop/ ← Tauri shell + reuses web build
│ └── mobile/ ← Expo React Native app
├── packages/
│ ├── api/ ← Shared API client (typed REST or tRPC)
│ ├── database/ ← Prisma schema, migrations, types
│ ├── ui/ ← Shared UI components (where feasible)
│ ├── sync/ ← PowerSync configuration and helpers
│ ├── auth/ ← Auth logic shared across platforms
│ ├── business-logic/ ← Domain logic (calculations, validations)
│ └── types/ ← Shared TypeScript types
├── turbo.json
└── package.json

Migrating the Phase 0 code:

- Move existing Next.js app from root to `apps/web/`
- Extract Prisma to `packages/database/`
- Extract shared types and business logic to respective packages
- Update imports throughout

## CRITICAL SCHEMA REQUIREMENTS FOR SYNC

These are non-negotiable for offline sync to work:

1. **All primary keys MUST be UUIDs**, not auto-increment integers.
   - Why: Devices generate IDs offline; integers collide.
2. **All tables MUST have `updatedAt` timestamp.**
   - Why: Sync engine uses it to determine which version is newer.

3. **Deletions are soft-deletes (`deletedAt` column), not DELETE statements.**
   - Why: Hard deletes cannot sync; other devices need to know what was deleted.

4. **All timestamps stored as UTC ISO-8601.**
   - Why: Time zone confusion across devices.

5. **`organizationId` on every domain table** (already in spec).

6. **Add `lastModifiedBy` (userId) and `lastModifiedDevice` (deviceId) to
   every mutable table.**
   - Why: Conflict resolution and audit.

7. **Conflict resolution strategy per table:**
   - Last-write-wins: DSREntry edits, Notes
   - Server-wins: Invoices (financial integrity)
   - Custom merge: Cart-like additive operations

8. **No server-side autoincrement counters that affect business logic.**
   - Invoice numbers etc. must be generated server-side ONLY when synced
     online, not on the client.

## OFFLINE BEHAVIOR RULES

### What works offline:

- Submit DSR (saves locally, syncs when online)
- View previously synced clients, products, distributors
- View own historical reports
- Draft invoices (saves locally; numbering and issuing happens online)
- Take photos and attach (uploaded when online)

### What requires online:

- Authentication (initial login; cached token works for 24h offline)
- Issuing invoices (requires sequential numbering from server)
- Recording payments (requires server confirmation)
- Inviting users
- Bulk operations
- AI features (chat, predictions)
- Reports beyond what was last synced

### Offline indicator:

- Persistent banner when offline: "Offline mode — your changes will sync when
  you reconnect."
- Show last sync time in profile dropdown
- Show queued (pending sync) item count

## PLATFORM-SPECIFIC FEATURES

### Mobile-Only

- Camera capture for DSR photo evidence
- GPS auto-capture for visits
- Barcode scanning for products
- Touch ID / Face ID auth
- Push notifications for: DSR approvals, payment received, AI alerts
- Voice notes (transcribed by AI when online)

### Desktop-Only

- Keyboard shortcuts everywhere
- Multi-window support (e.g. one window for inventory, another for reports)
- Native file system integration (drag PDF invoices to desktop)
- System tray icon with quick stats

### Web-Only

- Public marketing site
- Super Admin panel (do not put this in mobile/desktop apps)

## BUILD ORDER (REVISED)

This replaces the build order in the master prompt:

**Phase 1a** — Restructure into monorepo (after Phase 0 fixes)
**Phase 1b** — Update Prisma schema with sync requirements (UUIDs, soft deletes,
timestamps everywhere)
**Phase 1c** — Continue with original Phase 1 (users, roles, departments, branding)
**Phase 2** — Original Phase 2 (entities)
**Phase 3** — Original Phase 3 (DSR + invoicing)
**Phase 4** — Set up PowerSync, test sync end-to-end with web
**Phase 5** — Build mobile app (Expo) with offline sync
**Phase 6** — Build desktop app (Tauri) with offline sync
**Phase 7** — Original Phase 4 dashboards (now applied across platforms)
**Phase 8** — Original Phase 5 AI layer
**Phase 9** — Original Phase 6 platform billing
**Phase 10** — Polish + Launch

This stretches the timeline but produces a coherent multi-platform product.

## ALTERNATIVE: STAGED ROLLOUT (RECOMMENDED)

If full multi-platform from day one feels too risky, do this instead:

**Sprint 1 (now → 8 weeks):** Web app only, all phases 1–7 from master prompt
**Sprint 2 (week 9 → 12):** Make web a PWA (free; works offline-ish on mobile)
**Sprint 3 (week 13 → 18):** Mobile app via Expo, with sync
**Sprint 4 (week 19 → 24):** Desktop app via Tauri

Reasons to prefer staged:

- Get paying customers in month 3, not month 6
- Validate the product works before investing in 3 more codebases
- Pay yourself sooner
- Sync architecture decisions improve when you know real usage patterns
