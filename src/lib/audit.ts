import { prisma } from '@/lib/prisma'

type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'SUSPEND'
  | 'UNSUSPEND'
  | 'INVITE'
  | 'LOGIN'
  | 'BRANDING_CHANGE'
  | 'ROLE_ASSIGN'
  | 'PASSWORD_RESET'

export async function createAuditLog(opts: {
  organizationId: string
  userId?: string | null
  action: AuditAction
  entity: string
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
  req?: Request
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId ?? null,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId ?? null,
        oldValue: opts.oldValue !== undefined ? (opts.oldValue as object) : undefined,
        newValue: opts.newValue !== undefined ? (opts.newValue as object) : undefined,
        ipAddress: opts.req
          ? (opts.req.headers.get('x-forwarded-for') ?? opts.req.headers.get('x-real-ip') ?? null)
          : null,
        userAgent: opts.req ? (opts.req.headers.get('user-agent') ?? null) : null,
      },
    })
  } catch (err) {
    // Audit log failures must never bubble up and break the primary operation.
    console.error('[audit-log]', err)
  }
}
