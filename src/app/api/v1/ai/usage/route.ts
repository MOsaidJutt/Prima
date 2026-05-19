import { NextRequest } from 'next/server'
import { withTenantApi, apiOk } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { subDays, startOfMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'organization:read', async ({ ctx }) => {
    const orgId = ctx.organizationId
    const now = new Date()
    const monthStart = startOfMonth(now)

    const [org, wallet, usageByFeature, usageByUser, dailyUsage] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { monthlyTokenBudget: true, monthlyTokensUsed: true },
      }),
      prisma.tokenWallet.findUnique({ where: { organizationId: orgId } }),
      prisma.tokenUsageLog.groupBy({
        by: ['feature'],
        where: { organizationId: orgId, createdAt: { gte: monthStart } },
        _sum: { totalTokens: true, estimatedCostUsd: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
      }),
      prisma.tokenUsageLog.groupBy({
        by: ['userId'],
        where: { organizationId: orgId, createdAt: { gte: monthStart }, userId: { not: null } },
        _sum: { totalTokens: true, estimatedCostUsd: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 20,
      }),
      prisma.$queryRaw<Array<{ date: string; tokens: number; cost: number }>>`
        SELECT
          DATE("createdAt")::text AS date,
          SUM("totalTokens")::int AS tokens,
          SUM("estimatedCostUsd")::float AS cost
        FROM "TokenUsageLog"
        WHERE "organizationId" = ${orgId}::uuid
          AND "createdAt" >= ${subDays(now, 30)}
        GROUP BY DATE("createdAt")
        ORDER BY DATE("createdAt")
      `,
    ])

    const userIds = usageByUser.map((u) => u.userId).filter(Boolean) as string[]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    const daysElapsed = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const tokensUsed = org?.monthlyTokensUsed ?? 0
    const budget = org?.monthlyTokenBudget ?? 1
    const dailyRate = daysElapsed > 0 ? tokensUsed / daysElapsed : 0
    const daysRemaining =
      dailyRate > 0 ? Math.floor((budget - tokensUsed) / dailyRate) : daysInMonth

    return apiOk({
      budget: org?.monthlyTokenBudget ?? 0,
      used: org?.monthlyTokensUsed ?? 0,
      remaining: Math.max(0, (org?.monthlyTokenBudget ?? 0) - (org?.monthlyTokensUsed ?? 0)),
      percentUsed: Math.min(100, Math.round((tokensUsed / budget) * 100)),
      daysRemainingEstimate: Math.max(0, daysRemaining),
      wallet: wallet
        ? {
            balance: wallet.balance,
            totalPurchased: wallet.totalPurchased,
            totalConsumed: wallet.totalConsumed,
          }
        : null,
      byFeature: usageByFeature.map((f) => ({
        feature: f.feature,
        tokens: Number(f._sum.totalTokens ?? 0),
        costUsd: Number(f._sum.estimatedCostUsd ?? 0),
      })),
      byUser: usageByUser.map((u) => ({
        userId: u.userId,
        user: u.userId ? (userMap.get(u.userId) ?? null) : null,
        tokens: Number(u._sum.totalTokens ?? 0),
        costUsd: Number(u._sum.estimatedCostUsd ?? 0),
      })),
      dailyChart: dailyUsage,
    })
  })
}
