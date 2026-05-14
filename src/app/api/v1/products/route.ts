import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTenantApi, apiOk, apiError, generateEntityCode } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const createSchema = z.object({
  sku: z.string().optional(), // auto-gen if omitted
  barcode: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brand: z.string().optional(),
  unitOfMeasure: z.string().default('pcs'),
  packSize: z.number().int().min(1).default(1),
  costPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  mrp: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).default(0),
  reorderLevel: z.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).default('ACTIVE'),
  images: z.array(z.string().url()).default([]),
})

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'products:read', async ({ ctx }) => {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? 25))
    const search = url.searchParams.get('search') ?? ''
    const categoryId = url.searchParams.get('categoryId') ?? ''
    const status = url.searchParams.get('status') ?? ''

    const where = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
          { barcode: { contains: search, mode: 'insensitive' as const } },
          { brand: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(status && { status: status as 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' }),
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          sku: true,
          name: true,
          barcode: true,
          brand: true,
          sellingPrice: true,
          costPrice: true,
          taxRate: true,
          reorderLevel: true,
          status: true,
          images: true,
          createdAt: true,
          category: { select: { id: true, name: true } },
          inventoryStock: {
            select: { quantity: true, warehouseId: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ])

    // Add total stock per product
    const productsWithStock = products.map((p) => ({
      ...p,
      totalStock: p.inventoryStock.reduce((sum, s) => sum + s.quantity, 0),
    }))

    return apiOk({ products: productsWithStock, total, page, pageSize })
  })
}

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'products:create', async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0].message)

    // Auto-generate SKU if not provided
    let sku = parsed.data.sku?.trim()
    if (!sku) {
      const count = await prisma.product.count({ where: { organizationId: ctx.organizationId } })
      sku = `SKU-${String(count + 1).padStart(4, '0')}`
    }

    // Check SKU uniqueness
    const existing = await prisma.product.findFirst({
      where: { organizationId: ctx.organizationId, sku },
    })
    if (existing) return apiError(`SKU "${sku}" already exists`)

    const product = await prisma.product.create({
      data: { ...parsed.data, sku, organizationId: ctx.organizationId, lastModifiedBy: user.id },
    })

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'Product',
      entityId: product.id,
      newValue: product,
      req,
    })
    return apiOk(product, 201)
  })
}
