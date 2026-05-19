import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai/providers/factory'
import { logTokenUsage } from '@/lib/ai/wallet'
import { generateText } from 'ai'
import { createHash } from 'crypto'
import { z } from 'zod'

const schema = z.object({
  widgetKey: z.string().min(1).max(100),
  widgetTitle: z.string(),
  data: z.record(z.unknown()),
})

export async function POST(req: NextRequest) {
  return withTenantApi(req, null, async ({ ctx, user }) => {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')

    const { widgetKey, widgetTitle, data } = parsed.data
    const orgId = ctx.organizationId
    const dataStr = JSON.stringify(data)
    const dataHash = createHash('md5').update(dataStr).digest('hex')

    const cached = await prisma.aIInsight.findUnique({
      where: { organizationId_widgetKey: { organizationId: orgId, widgetKey } },
    })

    if (cached && cached.dataHash === dataHash && cached.expiresAt > new Date()) {
      return apiOk({ summary: cached.summary, cached: true })
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
        aiSettings: {
          select: { ollamaBaseUrl: true, embeddingModel: true, summariesEnabled: true },
        },
      },
    })

    if (!org?.aiEnabled || !org.aiSettings?.summariesEnabled) {
      return apiError('AI summaries are disabled.', 403)
    }

    const provider = getAIProvider(org)
    const model = provider.getLanguageModel()

    const { text, usage } = await generateText({
      model,
      prompt: `You are a business analyst for ${org.name}. Write a concise 3-sentence narrative summary of this dashboard widget.

Widget: ${widgetTitle}
Data: ${dataStr}

Rules: Focus on the most important insight. Mention specific numbers. Note trends or anomalies. Write in flowing prose, no bullet points.`,
    })

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.aIInsight.upsert({
      where: { organizationId_widgetKey: { organizationId: orgId, widgetKey } },
      create: {
        organizationId: orgId,
        widgetKey,
        summary: text,
        dataHash,
        expiresAt,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
      },
      update: {
        summary: text,
        dataHash,
        expiresAt,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
      },
    })

    await logTokenUsage({
      organizationId: orgId,
      userId: user.id,
      feature: 'summary',
      model: org.aiModel ?? 'unknown',
      provider: org.aiProvider ?? 'unknown',
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      referenceType: 'AIInsight',
      referenceId: widgetKey,
    })

    return apiOk({ summary: text, cached: false })
  })
}
