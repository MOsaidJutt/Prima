import { describe, it, expect, vi } from 'vitest'
import { withOrg, TenantScopedRepository } from '@/lib/tenant-context'

describe('withOrg', () => {
  it('injects organizationId into empty args', () => {
    const result = withOrg('org-123')
    expect(result.where.organizationId).toBe('org-123')
  })

  it('merges with existing where clause', () => {
    const result = withOrg('org-123', { where: { status: 'ACTIVE' } })
    expect(result.where.organizationId).toBe('org-123')
    expect(result.where.status).toBe('ACTIVE')
  })

  it('preserves non-where fields', () => {
    const result = withOrg('org-123', { orderBy: { createdAt: 'desc' }, take: 10 })
    expect(result.where.organizationId).toBe('org-123')
    expect(result.orderBy).toEqual({ createdAt: 'desc' })
    expect(result.take).toBe(10)
  })
})

describe('TenantScopedRepository', () => {
  const ctx = { organizationId: 'org-abc', userId: 'user-xyz' }

  it('scoped.findMany injects organizationId and deletedAt: null', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const repo = new TenantScopedRepository(ctx)
    await repo.scoped({ findMany } as never).findMany({ where: { status: 'ACTIVE' } })
    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', organizationId: 'org-abc', deletedAt: null },
    })
  })

  it('scoped.create injects organizationId and lastModifiedBy', async () => {
    const create = vi.fn().mockResolvedValue({ id: '1' })
    const repo = new TenantScopedRepository(ctx)
    await repo.scoped({ create } as never).create({ data: { name: 'Test' } })
    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'Test',
        organizationId: 'org-abc',
        lastModifiedBy: 'user-xyz',
        lastModifiedDevice: null,
      },
    })
  })

  it('scoped.delete issues update with deletedAt (soft delete, not hard DELETE)', async () => {
    const update = vi.fn().mockResolvedValue({ id: '1' })
    const repo = new TenantScopedRepository(ctx)
    await repo.scoped({ update } as never).delete({ where: { id: '1' } })
    const call = update.mock.calls[0][0] as Record<string, unknown>
    expect(call.where).toMatchObject({ id: '1', organizationId: 'org-abc' })
    expect((call.data as Record<string, unknown>).deletedAt).toBeInstanceOf(Date)
  })

  it('scoped.findMany excludes soft-deleted records by default', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const repo = new TenantScopedRepository(ctx)
    await repo.scoped({ findMany } as never).findMany()
    const call = findMany.mock.calls[0][0] as Record<string, unknown>
    expect((call.where as Record<string, unknown>).deletedAt).toBeNull()
  })

  it('deviceId defaults to null when not provided', async () => {
    const create = vi.fn().mockResolvedValue({})
    const repo = new TenantScopedRepository({ organizationId: 'org-1', userId: 'u-1' })
    await repo.scoped({ create } as never).create({ data: {} })
    const call = create.mock.calls[0][0] as Record<string, unknown>
    expect((call.data as Record<string, unknown>).lastModifiedDevice).toBeNull()
  })
})
