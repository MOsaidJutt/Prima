import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { getPaymentProvider } from '@/lib/payments/providers/factory'
import {
  ensurePaymentCustomer,
  listPaymentMethods,
  saveCardPaymentMethod,
} from '@/lib/billing/payment-methods'
import { createAuditLog } from '@/lib/audit'

const saveCardSchema = z.object({
  paymentMethodId: z.string().min(1),
  makeDefault: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:read',
    async ({ ctx }) => {
      const methods = await listPaymentMethods(ctx.organizationId)
      return apiOk({ paymentMethods: methods })
    },
    { bypassSubscriptionCheck: true }
  )
}

export async function POST(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:update',
    async ({ ctx }) => {
      try {
        const body = await req.json()
        const data = saveCardSchema.parse(body)

        const { customerId } = await ensurePaymentCustomer(ctx.organizationId)
        const provider = getPaymentProvider('STRIPE')
        const methods = await provider.listPaymentMethods(customerId)
        const match = methods.find((m) => m.id === data.paymentMethodId)
        if (!match) return apiError('Payment method not found.', 404)

        const saved = await saveCardPaymentMethod({
          organizationId: ctx.organizationId,
          providerPaymentMethodId: match.id,
          brand: match.brand,
          last4: match.last4,
          expMonth: match.expMonth,
          expYear: match.expYear,
          makeDefault: data.makeDefault,
        })

        await createAuditLog({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'CREATE',
          entity: 'BillingPaymentMethod',
          entityId: saved.id,
          newValue: { brand: saved.brand, last4: saved.last4, isDefault: saved.isDefault },
          req,
        })

        return apiOk(saved, 201)
      } catch (err) {
        if (err instanceof z.ZodError) return apiError(err.errors[0].message)
        throw err
      }
    },
    { bypassSubscriptionCheck: true }
  )
}
