import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

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

export async function logTokenUsage(params: LogUsageParams): Promise<void> {
  const { organizationId, inputTokens, outputTokens, model } = params
  const totalTokens = inputTokens + outputTokens
  const estimatedCostUsd = estimateCost(model, inputTokens, outputTokens)

  await prisma.$transaction(async (tx) => {
    // Write the usage log
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

    // Increment org monthly usage counter
    await tx.organization.update({
      where: { id: organizationId },
      data: { monthlyTokensUsed: { increment: totalTokens } },
    })

    // Update token wallet
    const now = new Date()
    const wallet = await tx.tokenWallet.findUnique({ where: { organizationId } })
    if (wallet) {
      // Reset monthly usage if a new month has started
      const shouldReset =
        wallet.monthlyResetAt.getMonth() !== now.getMonth() ||
        wallet.monthlyResetAt.getFullYear() !== now.getFullYear()

      await tx.tokenWallet.update({
        where: { organizationId },
        data: {
          totalConsumed: { increment: totalTokens },
          monthlyUsed: shouldReset ? totalTokens : { increment: totalTokens },
          monthlyResetAt: shouldReset ? now : undefined,
        },
      })
    }
  })
}

export async function checkBudget(
  organizationId: string
): Promise<{ allowed: boolean; remaining: number; budget: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      monthlyTokenBudget: true,
      monthlyTokensUsed: true,
      autoTopUpEnabled: true,
      autoTopUpPackId: true,
      aiEnabled: true,
    },
  })

  if (!org || !org.aiEnabled) return { allowed: false, remaining: 0, budget: 0 }

  const remaining = org.monthlyTokenBudget - org.monthlyTokensUsed
  if (remaining > 0) return { allowed: true, remaining, budget: org.monthlyTokenBudget }

  // Budget exhausted — notify admin
  await notifyBudgetExhausted(organizationId)

  return { allowed: false, remaining: 0, budget: org.monthlyTokenBudget }
}

async function notifyBudgetExhausted(organizationId: string) {
  // Find org owner to notify
  const ownerRole = await prisma.role.findFirst({
    where: { organizationId, name: 'Owner', deletedAt: null },
    select: { users: { select: { id: true }, take: 1 } },
  })

  if (!ownerRole?.users[0]) return

  await createNotification({
    organizationId,
    userId: ownerRole.users[0].id,
    type: 'ai_budget_exhausted' as const,
    title: 'AI Token Budget Exhausted',
    body: 'Your monthly AI token budget has been used up. AI features are now disabled until next month or you top up.',
    data: { actionUrl: '/admin/settings/ai/usage' },
  })
}

export async function ensureWalletExists(organizationId: string) {
  await prisma.tokenWallet.upsert({
    where: { organizationId },
    create: { organizationId, balance: 0 },
    update: {},
  })
}
