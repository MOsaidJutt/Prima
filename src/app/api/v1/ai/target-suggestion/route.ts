import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai/providers/factory'
import { logTokenUsage } from '@/lib/ai/wallet'
import { generateText } from 'ai'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { z } from 'zod'

const schema = z.object({
  scope: z.enum(['ORGANIZATION', 'DEPARTMENT', 'USER', 'PRODUCT', 'CLIENT']),
  type: z.enum(['REVENUE', 'UNITS', 'VISITS', 'NEW_CLIENTS', 'COLLECTIONS']),
  period: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  userId: z.string().optional(),
  departmentId: z.string().optional(),
  productId: z.string().optional(),
  clientId: z.string().optional(),
  proposedTarget: z.number().optional(),
})

export async function POST(req: NextRequest) {
  return withTenantApi(req, null, async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')

    const params = parsed.data
    const orgId = ctx.organizationId
    const now = new Date()

    const historyData: Array<{ month: string; value: number }> = []
    for (let i = 3; i >= 1; i--) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(subMonths(now, i))

      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId: orgId,
          issueDate: { gte: monthStart, lte: monthEnd },
          status: { in: ['PAID', 'PARTIALLY_PAID', 'ISSUED'] },
          deletedAt: null,
          ...(params.userId ? { createdById: params.userId } : {}),
          ...(params.clientId ? { clientId: params.clientId } : {}),
        },
        select: { grandTotal: true },
      })

      const value = invoices.reduce((s, i) => s + Number(i.grandTotal), 0)
      historyData.push({
        month: monthStart.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' }),
        value,
      })
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        aiEnabled: true,
        aiProvider: true,
        aiApiKeyEncrypted: true,
        aiModel: true,
        embeddingProvider: true,
        aiSettings: { select: { ollamaBaseUrl: true, embeddingModel: true } },
      },
    })

    if (!org?.aiEnabled) return apiError('AI is disabled.', 403)

    const provider = getAIProvider(org)
    const model = provider.getLanguageModel()

    const { text, usage } = await generateText({
      model,
      prompt: `You are a sales target advisor for ${org.name}.

Historical data (last 3 months):
${historyData.map((d) => `- ${d.month}: ${d.value.toLocaleString('en-PK')}`).join('\n')}

Target request:
- Scope: ${params.scope}
- Type: ${params.type}
- Period: ${params.period}
${params.proposedTarget ? `- Proposed target: ${params.proposedTarget.toLocaleString('en-PK')}` : ''}

Provide:
1. A suggested realistic target value (number only on first line)
2. Brief rationale (2-3 sentences)
3. Warning if proposed target is unrealistic (>50% YoY growth without clear trend)

Format:
SUGGESTED: [number]
RATIONALE: [text]
WARNING: [text or "none"]`,
    })

    const lines = text.split('\n').filter(Boolean)
    const suggested = parseFloat(
      lines
        .find((l) => l.startsWith('SUGGESTED:'))
        ?.replace('SUGGESTED:', '')
        .replace(/,/g, '')
        .trim() ?? '0'
    )
    const rationale =
      lines
        .find((l) => l.startsWith('RATIONALE:'))
        ?.replace('RATIONALE:', '')
        .trim() ?? text
    const warning = lines
      .find((l) => l.startsWith('WARNING:'))
      ?.replace('WARNING:', '')
      .trim()

    await logTokenUsage({
      organizationId: orgId,
      userId: user.id,
      feature: 'summary',
      model: org.aiModel ?? 'unknown',
      provider: org.aiProvider ?? 'unknown',
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
    })

    return apiOk({
      suggested: isNaN(suggested) ? null : suggested,
      rationale,
      warning: warning === 'none' ? null : warning,
      history: historyData,
    })
  })
}
