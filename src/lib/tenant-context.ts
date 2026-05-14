/**
 * TENANT ISOLATION PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 * Every database query in Prima MUST be scoped to an organizationId.
 * Never query Prisma directly without a where.organizationId clause.
 *
 * Usage in a Server Action or API route:
 *
 *   const ctx: TenantContext = { organizationId, userId }
 *   const repo = new TenantScopedRepository(ctx)
 *
 *   // Reads — auto-scoped to org, auto-filters deletedAt: null
 *   const clients = await repo.scoped(prisma.client).findMany({ where: { status: 'ACTIVE' } })
 *
 *   // Writes — auto-injects organizationId + lastModifiedBy
 *   const client = await repo.scoped(prisma.client).create({ data: { name: 'ACME' } })
 *
 *   // Soft delete — sets deletedAt instead of hard DELETE
 *   await repo.scoped(prisma.client).delete({ where: { id } })
 *
 * Raw Prisma escape hatch (use sparingly — must add organizationId manually):
 *   import { withOrg } from '@/lib/tenant-context'
 *   const result = await prisma.client.findMany(withOrg(orgId, { where: { city: 'Karachi' } }))
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Context object ────────────────────────────────────────────────────────────
// Extended in Phase 8 to include deviceId for conflict resolution metadata.

export type TenantContext = {
  organizationId: string
  userId?: string | null
  deviceId?: string | null // Phase 8: populated when request comes from mobile/desktop
}

// ── withOrg helper (escape hatch) ─────────────────────────────────────────────

export function withOrg<T extends Record<string, unknown>>(
  organizationId: string,
  args: T = {} as T
): T & { where: Record<string, unknown> } {
  return {
    ...args,
    where: {
      ...(args.where as Record<string, unknown>),
      organizationId,
    },
  }
}

// ── Internal delegate type ────────────────────────────────────────────────────

type AnyDelegate = {
  findMany: (args?: unknown) => Promise<unknown[]>
  findFirst: (args?: unknown) => Promise<unknown>
  findUnique: (args?: unknown) => Promise<unknown>
  create: (args: unknown) => Promise<unknown>
  update: (args: unknown) => Promise<unknown>
  updateMany: (args: unknown) => Promise<unknown>
  delete: (args: unknown) => Promise<unknown>
  count: (args?: unknown) => Promise<number>
}

// ── TenantScopedRepository ────────────────────────────────────────────────────

export class TenantScopedRepository {
  private readonly ctx: TenantContext

  constructor(ctx: TenantContext) {
    this.ctx = ctx
  }

  /**
   * Returns a scoped proxy for a Prisma model delegate.
   * All operations are automatically:
   *  - Scoped to organizationId
   *  - Filtered for deletedAt: null on reads
   *  - Stamped with lastModifiedBy on writes
   *  - Soft-deleted (deletedAt = now()) instead of hard-deleted
   */
  scoped(model: unknown) {
    const delegate = model as AnyDelegate
    const { organizationId, userId, deviceId } = this.ctx

    const modifiedMeta = {
      lastModifiedBy: userId ?? null,
      lastModifiedDevice: deviceId ?? null,
    }

    return {
      // ── Reads — scoped + soft-delete filter ──────────────────────────────

      findMany: (args: Record<string, unknown> = {}) =>
        delegate.findMany({
          ...args,
          where: {
            ...(args.where as Record<string, unknown>),
            organizationId,
            deletedAt: null,
          },
        }),

      findFirst: (args: Record<string, unknown> = {}) =>
        delegate.findFirst({
          ...args,
          where: {
            ...(args.where as Record<string, unknown>),
            organizationId,
            deletedAt: null,
          },
        }),

      findUnique: (args: Record<string, unknown> = {}) =>
        // findUnique uses a unique key — we can't inject where.organizationId
        // without breaking the unique constraint lookup. Caller must verify
        // the returned record belongs to this org.
        delegate.findUnique(args),

      count: (args: Record<string, unknown> = {}) =>
        delegate.count({
          ...args,
          where: {
            ...(args.where as Record<string, unknown>),
            organizationId,
            deletedAt: null,
          },
        }),

      // ── Writes — inject org + lastModifiedBy ─────────────────────────────

      create: (args: { data: Record<string, unknown>; [k: string]: unknown }) =>
        delegate.create({
          ...args,
          data: {
            ...args.data,
            organizationId,
            ...modifiedMeta,
          },
        }),

      update: (args: {
        where: Record<string, unknown>
        data: Record<string, unknown>
        [k: string]: unknown
      }) =>
        delegate.update({
          ...args,
          where: { ...args.where, organizationId },
          data: {
            ...args.data,
            ...modifiedMeta,
          },
        }),

      updateMany: (args: {
        where: Record<string, unknown>
        data: Record<string, unknown>
        [k: string]: unknown
      }) =>
        delegate.updateMany({
          ...args,
          where: {
            ...args.where,
            organizationId,
            deletedAt: null,
          },
          data: {
            ...args.data,
            ...modifiedMeta,
          },
        }),

      // ── Soft delete — sets deletedAt instead of hard DELETE ──────────────
      // Never issues a real DELETE statement on domain data.

      delete: (args: { where: Record<string, unknown>; [k: string]: unknown }) =>
        delegate.update({
          ...args,
          where: { ...args.where, organizationId },
          data: {
            deletedAt: new Date(),
            ...modifiedMeta,
          },
        }),

      // ── Hard delete — use ONLY for non-domain data (e.g. expired sessions) ─
      hardDelete: (args: Record<string, unknown>) => delegate.delete(args),
    }
  }
}
