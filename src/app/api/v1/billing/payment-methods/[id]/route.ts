import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { removePaymentMethod } from '@/lib/billing/payment-methods'
import { createAuditLog } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(
    req,
    'billing:update',
    async ({ ctx }) => {
      const { id } = await params

      const method = await prisma.billingPaymentMethod.findFirst({
        where: { id, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!method) return apiError('Payment method not found.', 404)

      await prisma.$transaction([
        prisma.billingPaymentMethod.updateMany({
          where: { organizationId: ctx.organizationId, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        }),
        prisma.billingPaymentMethod.update({ where: { id }, data: { isDefault: true } }),
      ])

      await createAuditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'UPDATE',
        entity: 'BillingPaymentMethod',
        entityId: id,
        oldValue: { isDefault: method.isDefault },
        newValue: { isDefault: true },
        req,
      })

      return apiOk({ success: true })
    },
    { bypassSubscriptionCheck: true }
  )
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(
    req,
    'billing:update',
    async ({ ctx }) => {
      const { id } = await params

      const method = await prisma.billingPaymentMethod.findFirst({
        where: { id, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!method) return apiError('Payment method not found.', 404)

      await removePaymentMethod(ctx.organizationId, id)

      await createAuditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'DELETE',
        entity: 'BillingPaymentMethod',
        entityId: id,
        oldValue: { brand: method.brand, last4: method.last4, isDefault: method.isDefault },
        req,
      })

      return apiOk({ success: true })
    },
    { bypassSubscriptionCheck: true }
  )
}
