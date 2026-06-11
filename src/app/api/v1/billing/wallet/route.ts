import { NextRequest } from 'next/server'
import { withTenantApi, apiOk } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { format, startOfDay, subDays } from 'date-fns'

const DEFAULT_USAGE_WINDOW_DAYS = 30
const ALLOWED_USAGE_WINDOW_DAYS = [30, 90, 365]

export async function GET(req: NextRequest) {
  return withTenantApi(
    req,
    'billing:read',
    async ({ ctx }) => {
      const url = new URL(req.url)
      const requestedDays = Number(url.searchParams.get('days'))
      const windowDays = ALLOWED_USAGE_WINDOW_DAYS.includes(requestedDays)
        ? requestedDays
        : DEFAULT_USAGE_WINDOW_DAYS

      const since = startOfDay(subDays(new Date(), windowDays - 1))

      const [org, wallet, dailyRows, featureRows] = await Promise.all([
        prisma.organization.findUniqueOrThrow({
          where: { id: ctx.organizationId },
          select: {
            monthlyTokenBudget: true,
            monthlyTokensUsed: true,
            autoTopUpEnabled: true,
            autoTopUpThreshold: true,
            autoTopUpPackId: true,
          },
        }),
        prisma.tokenWallet.findUnique({ where: { organizationId: ctx.organizationId } }),
        prisma.$queryRaw<{ day: Date; tokens: bigint }[]>`
          SELECT DATE_TRUNC('day', "createdAt") AS day, SUM("totalTokens")::bigint AS tokens
          FROM "TokenUsageLog"
          WHERE "organizationId" = ${ctx.organizationId} AND "createdAt" >= ${since}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY day ASC
        `,
        prisma.tokenUsageLog.groupBy({
          by: ['feature'],
          where: { organizationId: ctx.organizationId, createdAt: { gte: since } },
          _sum: { totalTokens: true, estimatedCostUsd: true },
        }),
      ])

      const dailyMap = new Map<string, number>()
      for (let i = 0; i < windowDays; i++) {
        dailyMap.set(format(subDays(new Date(), windowDays - 1 - i), 'yyyy-MM-dd'), 0)
      }
      for (const row of dailyRows) {
        dailyMap.set(format(row.day, 'yyyy-MM-dd'), Number(row.tokens))
      }

      const dailyUsage = Array.from(dailyMap.entries()).map(([date, tokens]) => ({ date, tokens }))
      const featureUsage = featureRows.map((row) => ({
        feature: row.feature,
        tokens: row._sum.totalTokens ?? 0,
        costUsd: Math.round(Number(row._sum.estimatedCostUsd ?? 0) * 1_000_000) / 1_000_000,
      }))

      return apiOk({
        wallet,
        budget: {
          monthlyTokenBudget: org.monthlyTokenBudget,
          monthlyTokensUsed: org.monthlyTokensUsed,
        },
        autoTopUp: {
          enabled: org.autoTopUpEnabled,
          threshold: org.autoTopUpThreshold,
          packId: org.autoTopUpPackId,
        },
        usageWindowDays: windowDays,
        dailyUsage,
        featureUsage,
      })
    },
    { bypassSubscriptionCheck: true }
  )
}
