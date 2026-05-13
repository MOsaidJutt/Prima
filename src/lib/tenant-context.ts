/**
 * TENANT ISOLATION PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 * Every database query in Prima MUST be scoped to an organizationId.
 * Never query Prisma directly without a where.organizationId clause.
 *
 * Usage (Server Action / API route):
 *   const repo = new TenantScopedRepository(session.organizationId)
 *   const clients = await repo.clients.findMany({ where: { status: 'ACTIVE' } })
 *
 * Usage with raw Prisma (escape hatch — use sparingly):
 *   import { withOrg } from '@/lib/tenant-context'
 *   const result = await prisma.client.findMany(withOrg(orgId, { where: { city: 'Karachi' } }))
 */

// Merges organizationId into any Prisma query args
export function withOrg<T extends Record<string, unknown>>(
  organizationId: string,
  args: T = {} as T
): T & { where: { organizationId: string } } {
  return {
    ...args,
    where: {
      ...(args.where as Record<string, unknown>),
      organizationId,
    },
  }
}

// Simple type for a Prisma delegate with basic CRUD
type AnyDelegate = {
  findMany: (args?: unknown) => Promise<unknown[]>
  findFirst: (args?: unknown) => Promise<unknown>
  create: (args: unknown) => Promise<unknown>
  update: (args: unknown) => Promise<unknown>
  delete: (args: unknown) => Promise<unknown>
  count: (args?: unknown) => Promise<number>
}

export class TenantScopedRepository {
  constructor(private readonly organizationId: string) {}

  private delegate<T extends AnyDelegate>(model: T): T {
    return model
  }

  scoped(model: unknown) {
    const delegate = model as AnyDelegate
    const orgId = this.organizationId
    return {
      findMany: (args: Record<string, unknown> = {}) => delegate.findMany(withOrg(orgId, args)),
      findFirst: (args: Record<string, unknown> = {}) => delegate.findFirst(withOrg(orgId, args)),
      create: (args: { data: Record<string, unknown>; [k: string]: unknown }) =>
        delegate.create({ ...args, data: { ...args.data, organizationId: orgId } }),
      update: (args: Record<string, unknown>) => delegate.update(withOrg(orgId, args)),
      delete: (args: Record<string, unknown>) => delegate.delete(withOrg(orgId, args)),
      count: (args: Record<string, unknown> = {}) => delegate.count(withOrg(orgId, args)),
    }
  }
}
