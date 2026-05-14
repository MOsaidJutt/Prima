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
 *   // Lookup by ID — must use findFirst, never findUnique
 *   const client = await repo.scoped(prisma.client).findFirst({ where: { id } })
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
 *
 * C-4: findUnique is intentionally absent from TenantScopedRepository.
 * findUnique bypasses organizationId scoping (unique constraints use only the
 * key field). Removing it instead of asserting prevents the misuse pattern
 * entirely — a removed method cannot be forgotten.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Context object ────────────────────────────────────────────────────────────

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
// findUnique deliberately excluded — see C-4 note above.

type AnyDelegate = {
  findMany: (args?: unknown) => Promise<unknown[]>
  findFirst: (args?: unknown) => Promise<unknown>
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

  scoped(model: unknown) {
    const delegate = model as AnyDelegate
    const { organizationId, userId, deviceId } = this.ctx

    const modifiedMeta = {
      lastModifiedBy: userId ?? null,
      lastModifiedDevice: deviceId ?? null,
    }

    return {
      // ── Reads ─────────────────────────────────────────────────────────────

      findMany: (args: Record<string, unknown> = {}) =>
        delegate.findMany({
          ...args,
          where: { ...(args.where as Record<string, unknown>), organizationId, deletedAt: null },
        }),

      // findFirst is the correct way to look up by ID within a tenant scope:
      //   findFirst({ where: { id, organizationId } }) — enforces both constraints.
      findFirst: (args: Record<string, unknown> = {}) =>
        delegate.findFirst({
          ...args,
          where: { ...(args.where as Record<string, unknown>), organizationId, deletedAt: null },
        }),

      count: (args: Record<string, unknown> = {}) =>
        delegate.count({
          ...args,
          where: { ...(args.where as Record<string, unknown>), organizationId, deletedAt: null },
        }),

      // ── Writes ────────────────────────────────────────────────────────────

      create: (args: { data: Record<string, unknown>; [k: string]: unknown }) =>
        delegate.create({
          ...args,
          data: { ...args.data, organizationId, ...modifiedMeta },
        }),

      update: (args: {
        where: Record<string, unknown>
        data: Record<string, unknown>
        [k: string]: unknown
      }) =>
        delegate.update({
          ...args,
          where: { ...args.where, organizationId },
          data: { ...args.data, ...modifiedMeta },
        }),

      updateMany: (args: {
        where: Record<string, unknown>
        data: Record<string, unknown>
        [k: string]: unknown
      }) =>
        delegate.updateMany({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
          data: { ...args.data, ...modifiedMeta },
        }),

      // ── Soft delete ───────────────────────────────────────────────────────
      // Never issues a real DELETE. Sets deletedAt = now().

      delete: (args: { where: Record<string, unknown>; [k: string]: unknown }) =>
        delegate.update({
          ...args,
          where: { ...args.where, organizationId },
          data: { deletedAt: new Date(), ...modifiedMeta },
        }),

      // ── Hard delete — ONLY for non-domain data (e.g. expired sessions) ───
      hardDelete: (args: Record<string, unknown>) => delegate.delete(args),
    }
  }
}
