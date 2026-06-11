import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { triggerAutoTopUpIfNeeded } from '@/lib/billing/topup'
import { isFeatureRestricted } from '@/lib/billing/status'

interface LogUsageParams {
  organizationId: string
  userId?: string
  feature: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  referenceType?: string
  referenceId?: string
}

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = COST_PER_1M[model] ?? { input: 1.0, output: 3.0 }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

/** Notify at 80%, 95%, and 100% (exhausted) of a monthly allowance — fired once per crossing. */
const USAGE_ALERT_THRESHOLDS = [1, 0.95, 0.8] as const

function isNewMonth(date: Date, now: Date): boolean {
  return date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()
}

function crossedThreshold(before: number, after: number, limit: number): number | null {
  if (limit <= 0) return null
  for (const pct of USAGE_ALERT_THRESHOLDS) {
    const threshold = limit * pct
    if (before < threshold && after >= threshold) return pct
  }
  return null
}

export async function logTokenUsage(params: LogUsageParams): Promise<void> {
  const { organizationId, userId, inputTokens, outputTokens, model } = params
  const totalTokens = inputTokens + outputTokens
  const estimatedCostUsd = estimateCost(model, inputTokens, outputTokens)
  const now = new Date()

  const { walletCrossing, userCrossing } = await prisma.$transaction(async (tx) => {
    await tx.tokenUsageLog.create({
      data: {
        organizationId,
        userId: params.userId,
        feature: params.feature,
        model,
        provider: params.provider,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
    })

    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { monthlyTokenBudget: true, monthlyTokensUsed: true },
    })

    await tx.organization.update({
      where: { id: organizationId },
      data: { monthlyTokensUsed: { increment: totalTokens } },
    })

    // Usage beyond the plan's monthly allowance draws down the purchased token wallet.
    const planAvailable = Math.max(0, org.monthlyTokenBudget - org.monthlyTokensUsed)
    const fromWallet = Math.max(0, totalTokens - planAvailable)

    const wallet = await tx.tokenWallet.findUnique({ where: { organizationId } })
    if (wallet) {
      const shouldReset = isNewMonth(wallet.monthlyResetAt, now)
      await tx.tokenWallet.update({
        where: { organizationId },
        data: {
          ...(fromWallet > 0
            ? { balance: { decrement: Math.min(fromWallet, wallet.balance) } }
            : {}),
          totalConsumed: { increment: totalTokens },
          monthlyUsed: shouldReset ? totalTokens : { increment: totalTokens },
          monthlyResetAt: shouldReset ? now : undefined,
        },
      })
    }

    const walletPct = crossedThreshold(
      org.monthlyTokensUsed,
      org.monthlyTokensUsed + totalTokens,
      org.monthlyTokenBudget
    )

    let userCrossing: { pct: number; quota: number } | null = null
    if (userId) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { aiTokenQuota: true, aiQuotaUsed: true, aiQuotaResetAt: true },
      })
      if (user && user.aiTokenQuota !== null) {
        const userShouldReset = isNewMonth(user.aiQuotaResetAt, now)
        const before = userShouldReset ? 0 : user.aiQuotaUsed
        const after = before + totalTokens

        await tx.user.update({
          where: { id: userId },
          data: {
            aiQuotaUsed: userShouldReset ? totalTokens : { increment: totalTokens },
            aiQuotaResetAt: userShouldReset ? now : undefined,
          },
        })

        const pct = crossedThreshold(before, after, user.aiTokenQuota)
        if (pct !== null) userCrossing = { pct, quota: user.aiTokenQuota }
      }
    }

    return {
      walletCrossing:
        walletPct !== null ? { pct: walletPct, budget: org.monthlyTokenBudget } : null,
      userCrossing,
    }
  })

  if (walletCrossing) {
    await notifyWalletThreshold(organizationId, walletCrossing.pct, walletCrossing.budget)
  }
  if (userId && userCrossing) {
    await notifyUserQuotaThreshold(organizationId, userId, userCrossing.pct, userCrossing.quota)
  }

  await triggerAutoTopUpIfNeeded(organizationId).catch((err) => {
    console.error('[wallet] auto-top-up check failed', err)
  })
}

export async function checkBudget(
  organizationId: string,
  userId?: string
): Promise<{ allowed: boolean; remaining: number; budget: number; walletBalance: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      monthlyTokenBudget: true,
      monthlyTokensUsed: true,
      aiEnabled: true,
      status: true,
      pastDueAt: true,
    },
  })

  // AI is also gated off for SUSPENDED/CANCELLED orgs and PAST_DUE orgs
  // restricted for >= PAST_DUE_RESTRICTION_DAYS (see isFeatureRestricted).
  if (!org || !org.aiEnabled || isFeatureRestricted(org)) {
    return { allowed: false, remaining: 0, budget: 0, walletBalance: 0 }
  }

  const wallet = await prisma.tokenWallet.findUnique({
    where: { organizationId },
    select: { balance: true },
  })
  const walletBalance = wallet?.balance ?? 0
  const remaining = org.monthlyTokenBudget - org.monthlyTokensUsed + walletBalance

  if (remaining <= 0) {
    return { allowed: false, remaining: 0, budget: org.monthlyTokenBudget, walletBalance }
  }

  if (userId) {
    const quota = await checkUserQuota(organizationId, userId)
    if (!quota.allowed) {
      return { allowed: false, remaining: 0, budget: org.monthlyTokenBudget, walletBalance }
    }
  }

  return { allowed: true, remaining, budget: org.monthlyTokenBudget, walletBalance }
}

/** Per-user AI token quota check (Business+ only, OrganizationAISettings.perUserQuotasEnabled). */
export async function checkUserQuota(
  organizationId: string,
  userId: string
): Promise<{ allowed: boolean; remaining: number; quota: number | null }> {
  const settings = await prisma.organizationAISettings.findUnique({
    where: { organizationId },
    select: { perUserQuotasEnabled: true },
  })
  if (!settings?.perUserQuotasEnabled) return { allowed: true, remaining: Infinity, quota: null }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiTokenQuota: true, aiQuotaUsed: true, aiQuotaResetAt: true },
  })
  if (!user || user.aiTokenQuota === null)
    return { allowed: true, remaining: Infinity, quota: null }

  const used = isNewMonth(user.aiQuotaResetAt, new Date()) ? 0 : user.aiQuotaUsed
  const remaining = user.aiTokenQuota - used
  return { allowed: remaining > 0, remaining, quota: user.aiTokenQuota }
}

async function notifyWalletThreshold(
  organizationId: string,
  pct: number,
  budget: number
): Promise<void> {
  const ownerRole = await prisma.role.findFirst({
    where: { organizationId, name: 'Owner', deletedAt: null },
    select: { users: { select: { id: true }, take: 1 } },
  })
  if (!ownerRole?.users[0]) return

  if (pct >= 1) {
    await createNotification({
      organizationId,
      userId: ownerRole.users[0].id,
      type: 'ai_budget_exhausted',
      title: 'AI token allowance exhausted',
      body: 'Your monthly AI token allowance has been used up. Purchase a token top-up to continue using AI features without interruption.',
      data: { actionUrl: '/admin/billing' },
    })
    return
  }

  await createNotification({
    organizationId,
    userId: ownerRole.users[0].id,
    type: 'billing_wallet_low',
    title: `AI token usage at ${Math.round(pct * 100)}%`,
    body: `Your organization has used ${Math.round(pct * 100)}% of its monthly AI token allowance (${budget.toLocaleString()} tokens). Consider enabling auto-top-up or purchasing more tokens.`,
    data: { actionUrl: '/admin/billing' },
  })
}

async function notifyUserQuotaThreshold(
  organizationId: string,
  userId: string,
  pct: number,
  quota: number
): Promise<void> {
  const label = pct >= 1 ? 'exhausted' : `${Math.round(pct * 100)}%`
  await createNotification({
    organizationId,
    userId,
    type: 'token_quota_warning',
    title: pct >= 1 ? 'Your AI token quota is exhausted' : `Your AI token quota is at ${label}`,
    body:
      pct >= 1
        ? 'You have used your full monthly AI token quota. Contact your admin to increase it, or wait until next month.'
        : `You have used ${label} of your monthly AI token quota (${quota.toLocaleString()} tokens).`,
    data: { actionUrl: '/admin/profile' },
  })
}

export async function ensureWalletExists(organizationId: string) {
  await prisma.tokenWallet.upsert({
    where: { organizationId },
    create: { organizationId, balance: 0 },
    update: {},
  })
}
