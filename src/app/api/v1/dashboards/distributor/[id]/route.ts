import { NextResponse } from 'next/server'
import { withTenantApi } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, dashboardKey } from '@/lib/dashboard-cache'
import { subMonths, startOfMonth, format } from 'date-fns'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withTenantApi(req, 'dashboard:read', async ({ ctx }) => {
    const { id } = await params
    const orgId = ctx.organizationId

    const cacheKey = dashboardKey(orgId, `distributor_${id}`)
    const cached = await cacheGet(cacheKey)
    if (cached)
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      }) as never

    const distributor = await prisma.distributor.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    })
    if (!distributor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [clients, recentInvoices, monthlyRevenue] = await Promise.all([
      prisma.client.findMany({
        where: { distributorId: id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          code: true,
          companyName: true,
          status: true,
          currentBalance: true,
          lastOrderDate: true,
        },
        orderBy: { totalLifetimeValue: 'desc' },
        take: 20,
      }),
      prisma.invoice.findMany({
        where: { distributorId: id, organizationId: orgId, deletedAt: null },
        orderBy: { issueDate: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          grandTotal: true,
          paidAmount: true,
          issueDate: true,
          dueDate: true,
        },
      }),
      Promise.all(
        Array.from({ length: 6 }).map(async (_, i) => {
          const now = new Date()
          const d = subMonths(now, 5 - i)
          const agg = await prisma.invoice.aggregate({
            where: {
              distributorId: id,
              organizationId: orgId,
              issueDate: { gte: startOfMonth(d) },
              deletedAt: null,
            },
            _sum: { grandTotal: true, paidAmount: true },
          })
          return {
            name: format(d, 'MMM yy'),
            invoiced: Number(agg._sum.grandTotal ?? 0),
            collected: Number(agg._sum.paidAmount ?? 0),
          }
        })
      ),
    ])

    const data = {
      distributor: {
        id: distributor.id,
        code: distributor.code,
        name: distributor.companyName,
        status: distributor.status,
        tier: distributor.tier,
        creditLimit: Number(distributor.creditLimit),
        currentBalance: Number(distributor.currentBalance),
        totalPurchases: Number(distributor.totalPurchases),
        rating: Number(distributor.rating),
        city: distributor.city,
      },
      kpis: {
        clientCount: clients.length,
        creditUtilization:
          Number(distributor.creditLimit) > 0
            ? (Number(distributor.currentBalance) / Number(distributor.creditLimit)) * 100
            : 0,
        outstandingBalance: Number(distributor.currentBalance),
        totalPurchases: Number(distributor.totalPurchases),
      },
      clients: clients.map((c) => ({ ...c, balance: Number(c.currentBalance) })),
      recentInvoices: recentInvoices.map((inv) => ({
        ...inv,
        grandTotal: Number(inv.grandTotal),
        paidAmount: Number(inv.paidAmount),
      })),
      monthlyRevenue,
    }

    await cacheSet(cacheKey, data)
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }) as never
  })
}
