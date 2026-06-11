import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type NotificationType =
  | 'user_invited'
  | 'role_changed'
  | 'department_assigned'
  | 'system'
  | 'low_stock' // Phase 2
  | 'dsr_approved' // Phase 3
  | 'dsr_rejected' // Phase 3
  | 'invoice_overdue' // Phase 3
  | 'ai_insight' // Phase 5
  | 'ai_budget_exhausted' // Phase 5
  | 'ai_recommendation' // Phase 5
  | 'billing_topup_success' // Phase 6
  | 'billing_topup_failed' // Phase 6
  | 'billing_payment_failed' // Phase 6
  | 'billing_past_due' // Phase 6
  | 'billing_suspended' // Phase 6
  | 'billing_trial_ending' // Phase 6
  | 'token_quota_warning' // Phase 6
  | 'billing_wallet_low' // Phase 6

export async function createNotification(opts: {
  organizationId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Prisma.InputJsonValue
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        data: opts.data,
      },
    })
  } catch (err) {
    console.error('[notification]', err)
  }
}

export async function notifyAdmins(opts: {
  organizationId: string
  type: NotificationType
  title: string
  body: string
  data?: Prisma.InputJsonValue
}): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        organizationId: opts.organizationId,
        isActive: true,
        deletedAt: null,
        role: { permissions: { hasSome: ['*', 'users:invite'] } },
      },
      select: { id: true },
    })

    await Promise.all(admins.map((a) => createNotification({ ...opts, userId: a.id })))
  } catch (err) {
    console.error('[notify-admins]', err)
  }
}
