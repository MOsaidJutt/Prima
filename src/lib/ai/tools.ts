import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export function buildOrgTools(organizationId: string) {
  return {
    get_revenue: tool({
      description: 'Get revenue for the organization for a given period, with optional breakdown.',
      inputSchema: z.object({
        period: z.enum([
          'today',
          'this_week',
          'this_month',
          'last_month',
          'last_90_days',
          'this_year',
        ]),
        breakdown: z
          .enum(['daily', 'weekly', 'monthly', 'by_user', 'by_client', 'by_product'])
          .optional(),
      }),
      execute: async ({ period, breakdown }) => {
        const { from, to } = periodToRange(period)
        const invoices = await prisma.invoice.findMany({
          where: {
            organizationId,
            issueDate: { gte: from, lte: to },
            status: { in: ['PAID', 'PARTIALLY_PAID', 'ISSUED'] },
            deletedAt: null,
          },
          select: { grandTotal: true, paidAmount: true, issueDate: true },
        })
        const totalRevenue = invoices.reduce((s, i) => s + Number(i.grandTotal), 0)
        const totalCollected = invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
        return {
          period,
          from: from.toISOString(),
          to: to.toISOString(),
          totalRevenue,
          totalCollected,
          invoiceCount: invoices.length,
          breakdown: breakdown ?? null,
        }
      },
    }),

    get_top_clients: tool({
      description: 'Get top clients by revenue or order count.',
      inputSchema: z.object({
        limit: z.number().min(1).max(20).default(5),
        by: z.enum(['revenue', 'order_count', 'outstanding_balance']).default('revenue'),
      }),
      execute: async ({ limit, by }) => {
        const clients = await prisma.client.findMany({
          where: { organizationId, deletedAt: null },
          select: {
            id: true,
            companyName: true,
            code: true,
            totalLifetimeValue: true,
            totalOrders: true,
            currentBalance: true,
            paymentBehaviorLabel: true,
          },
          orderBy:
            by === 'revenue'
              ? { totalLifetimeValue: 'desc' }
              : by === 'order_count'
                ? { totalOrders: 'desc' }
                : { currentBalance: 'desc' },
          take: limit,
        })
        return { clients, by }
      },
    }),

    get_inventory_status: tool({
      description: 'Get current inventory stock levels, optionally filtered by category.',
      inputSchema: z.object({
        category: z.string().optional(),
        lowStockOnly: z.boolean().optional(),
      }),
      execute: async ({ category, lowStockOnly }) => {
        const products = await prisma.product.findMany({
          where: {
            organizationId,
            deletedAt: null,
            ...(category
              ? { category: { name: { contains: category, mode: 'insensitive' } } }
              : {}),
          },
          include: {
            inventoryStock: { select: { quantity: true } },
            category: { select: { name: true } },
          },
          take: 50,
        })
        const result = products
          .map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            category: p.category?.name ?? null,
            totalQty: p.inventoryStock.reduce((s, s2) => s + s2.quantity, 0),
            reorderLevel: p.reorderLevel,
            isLowStock: p.inventoryStock.reduce((s, s2) => s + s2.quantity, 0) <= p.reorderLevel,
          }))
          .filter((p) => !lowStockOnly || p.isLowStock)
        return { products: result, lowStockCount: result.filter((p) => p.isLowStock).length }
      },
    }),

    get_overdue_invoices: tool({
      description: 'Get all overdue invoices and their amounts.',
      inputSchema: z.object({}),
      execute: async () => {
        const invoices = await prisma.invoice.findMany({
          where: { organizationId, status: 'OVERDUE', deletedAt: null },
          include: { client: { select: { companyName: true, code: true } } },
          orderBy: { dueDate: 'asc' },
          take: 30,
        })
        const total = invoices.reduce(
          (s, i) => s + (Number(i.grandTotal) - Number(i.paidAmount)),
          0
        )
        return {
          overdue: invoices.map((i) => ({
            invoiceNumber: i.invoiceNumber,
            client: i.client.companyName,
            dueDate: i.dueDate,
            outstanding: Number(i.grandTotal) - Number(i.paidAmount),
          })),
          totalOutstanding: total,
          count: invoices.length,
        }
      },
    }),

    get_employee_performance: tool({
      description: 'Get performance metrics for an employee or all employees.',
      inputSchema: z.object({
        userId: z.string().optional(),
        period: z
          .enum(['this_month', 'last_month', 'last_30_days', 'last_90_days'])
          .default('this_month'),
      }),
      execute: async ({ userId, period }) => {
        const { from, to } = periodToRange(period)
        const snapshots = await prisma.performanceSnapshot.findMany({
          where: {
            organizationId,
            snapshotDate: { gte: from, lte: to },
            ...(userId ? { userId } : {}),
          },
          include: { user: { select: { name: true, email: true } } },
        })
        const byUser = new Map<
          string,
          { name: string; dsrCount: number; revenue: number; visits: number }
        >()
        for (const s of snapshots) {
          if (!s.userId || !s.user) continue
          const existing = byUser.get(s.userId) ?? {
            name: s.user.name,
            dsrCount: 0,
            revenue: 0,
            visits: 0,
          }
          byUser.set(s.userId, {
            name: existing.name,
            dsrCount: existing.dsrCount + s.dsrCount,
            revenue: existing.revenue + Number(s.totalRevenue),
            visits: existing.visits + s.visitCount,
          })
        }
        return {
          period,
          employees: Array.from(byUser.entries()).map(([id, data]) => ({ id, ...data })),
        }
      },
    }),
  }
}

function periodToRange(period: string): { from: Date; to: Date } {
  const now = new Date()
  switch (period) {
    case 'today':
      return { from: new Date(now.setHours(0, 0, 0, 0)), to: new Date() }
    case 'this_week':
      return { from: subDays(now, 7), to: now }
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'last_month':
      return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) }
    case 'last_90_days':
    case 'last_30_days':
      return { from: subDays(now, 90), to: now }
    case 'this_year':
      return { from: new Date(now.getFullYear(), 0, 1), to: now }
    default:
      return { from: subDays(now, 30), to: now }
  }
}
