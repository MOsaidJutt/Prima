import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { generateInvoiceNumber } from '@/lib/invoice-helpers'
import { nanoid } from 'nanoid'

const lineItemSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discountType: z.enum(['PERCENT', 'FLAT']).optional().nullable(),
  discountValue: z.number().min(0).optional().nullable(),
  taxRate: z.number().min(0).max(100).default(0),
  sortOrder: z.number().int().default(0),
})

const createSchema = z.object({
  clientId: z.string().uuid(),
  distributorId: z.string().uuid().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  shippingAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
  issue: z.boolean().default(false), // true = immediately issue
})

function calcLineItems(items: z.infer<typeof lineItemSchema>[]) {
  return items.map((li) => {
    const lineBase = li.quantity * li.unitPrice
    let discountAmount = 0
    if (li.discountType === 'PERCENT' && li.discountValue)
      discountAmount = (lineBase * li.discountValue) / 100
    else if (li.discountType === 'FLAT' && li.discountValue) discountAmount = li.discountValue
    const taxAmount = ((lineBase - discountAmount) * li.taxRate) / 100
    return { ...li, discountAmount, taxAmount, lineTotal: lineBase - discountAmount + taxAmount }
  })
}

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'invoices:read', async ({ ctx }) => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? 25))
    const status = url.searchParams.get('status') ?? ''
    const clientId = url.searchParams.get('clientId') ?? ''
    const search = url.searchParams.get('search') ?? ''
    const overdue = url.searchParams.get('overdue') === 'true'

    const where = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(status
        ? {
            status: status as
              | 'DRAFT'
              | 'ISSUED'
              | 'PARTIALLY_PAID'
              | 'PAID'
              | 'OVERDUE'
              | 'CANCELLED',
          }
        : {}),
      ...(clientId ? { clientId } : {}),
      ...(overdue ? { status: 'OVERDUE' as const } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
              { client: { companyName: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          client: { select: { id: true, companyName: true, code: true } },
          _count: { select: { lineItems: true, payments: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ])

    return apiOk({ data: invoices, total, page, pageSize })
  })
}

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'invoices:create', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')
    const d = parsed.data

    const client = await prisma.client.findFirst({
      where: { id: d.clientId, organizationId: ctx.organizationId, deletedAt: null },
      select: { paymentTerms: true },
    })
    if (!client) return apiError('Client not found', 404)

    const calculatedItems = calcLineItems(d.lineItems)
    const subtotal = calculatedItems.reduce(
      (s, li) => s + li.quantity * li.unitPrice - li.discountAmount,
      0
    )
    const taxTotal = calculatedItems.reduce((s, li) => s + li.taxAmount, 0)
    const discountTotal = calculatedItems.reduce((s, li) => s + li.discountAmount, 0)
    const grandTotal = subtotal + taxTotal + d.shippingAmount

    const invoiceNumber = await generateInvoiceNumber(ctx.organizationId)
    const dueDate = d.dueDate
      ? new Date(d.dueDate)
      : new Date(Date.now() + (client.paymentTerms ?? 30) * 24 * 60 * 60 * 1000)

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: ctx.organizationId,
        invoiceNumber,
        clientId: d.clientId,
        distributorId: d.distributorId ?? null,
        templateId: d.templateId ?? null,
        status: d.issue ? 'ISSUED' : 'DRAFT',
        issueDate: d.issueDate ? new Date(d.issueDate) : new Date(),
        dueDate,
        subtotal,
        taxTotal,
        discountTotal,
        shippingAmount: d.shippingAmount,
        grandTotal,
        paidAmount: 0,
        notes: d.notes ?? null,
        terms: d.terms ?? null,
        trackingToken: nanoid(32),
        createdById: user.id,
        lastModifiedBy: user.id,
        lineItems: {
          create: calculatedItems.map((li) => ({
            productId: li.productId ?? null,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            discountType: li.discountType ?? null,
            discountValue: li.discountValue ?? null,
            discountAmount: li.discountAmount,
            taxRate: li.taxRate,
            taxAmount: li.taxAmount,
            lineTotal: li.lineTotal,
            sortOrder: li.sortOrder,
          })),
        },
      },
      include: { lineItems: true },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'Invoice',
      entityId: invoice.id,
      newValue: { invoiceNumber, status: invoice.status, grandTotal },
      req,
    })

    return apiOk(invoice, 201)
  })
}
