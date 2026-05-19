import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { encryptApiKey } from '@/lib/ai/crypto'
import { z } from 'zod'

const settingsSchema = z.object({
  aiEnabled: z.boolean(),
  aiProvider: z.enum(['CLAUDE', 'OPENAI', 'GEMINI', 'OLLAMA']).nullable(),
  apiKey: z.string().optional(),
  aiModel: z.string().nullable(),
  embeddingProvider: z.string().nullable(),
  monthlyTokenBudget: z.number().min(1000).max(100_000_000),
  autoTopUpEnabled: z.boolean(),
  autoTopUpThreshold: z.number().optional(),
  ollamaBaseUrl: z.string().url().optional().nullable(),
  embeddingModel: z.string().optional(),
  perUserQuotasEnabled: z.boolean().optional(),
  defaultUserQuota: z.number().optional(),
  chatEnabled: z.boolean().optional(),
  predictionsEnabled: z.boolean().optional(),
  summariesEnabled: z.boolean().optional(),
  scoringEnabled: z.boolean().optional(),
  anomalyEnabled: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  return withTenantApi(req, 'organization:update', async ({ ctx }) => {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: {
        aiEnabled: true,
        aiProvider: true,
        aiApiKeyEncrypted: true,
        aiModel: true,
        embeddingProvider: true,
        monthlyTokenBudget: true,
        monthlyTokensUsed: true,
        autoTopUpEnabled: true,
        autoTopUpThreshold: true,
        aiSettings: true,
      },
    })

    const { aiApiKeyEncrypted, ...rest } = org ?? {}

    return apiOk({ ...rest, hasApiKey: !!aiApiKeyEncrypted })
  })
}

export async function PUT(req: NextRequest) {
  return withTenantApi(req, 'organization:update', async ({ ctx }) => {
    const body = await req.json()
    const parsed = settingsSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')

    const data = parsed.data

    const orgUpdate: Record<string, unknown> = {
      aiEnabled: data.aiEnabled,
      aiProvider: data.aiProvider,
      aiModel: data.aiModel,
      embeddingProvider: data.embeddingProvider,
      monthlyTokenBudget: data.monthlyTokenBudget,
      autoTopUpEnabled: data.autoTopUpEnabled,
      autoTopUpThreshold: data.autoTopUpThreshold,
    }

    if (data.apiKey && data.apiKey.length > 0) {
      orgUpdate.aiApiKeyEncrypted = encryptApiKey(data.apiKey)
    }

    await prisma.$transaction([
      prisma.organization.update({ where: { id: ctx.organizationId }, data: orgUpdate }),
      prisma.organizationAISettings.upsert({
        where: { organizationId: ctx.organizationId },
        create: {
          organizationId: ctx.organizationId,
          ollamaBaseUrl: data.ollamaBaseUrl ?? null,
          embeddingModel: data.embeddingModel ?? 'text-embedding-3-small',
          perUserQuotasEnabled: data.perUserQuotasEnabled ?? false,
          defaultUserQuota: data.defaultUserQuota ?? 10000,
          chatEnabled: data.chatEnabled ?? true,
          predictionsEnabled: data.predictionsEnabled ?? true,
          summariesEnabled: data.summariesEnabled ?? true,
          scoringEnabled: data.scoringEnabled ?? true,
          anomalyEnabled: data.anomalyEnabled ?? true,
        },
        update: {
          ollamaBaseUrl: data.ollamaBaseUrl ?? null,
          embeddingModel: data.embeddingModel,
          perUserQuotasEnabled: data.perUserQuotasEnabled,
          defaultUserQuota: data.defaultUserQuota,
          chatEnabled: data.chatEnabled,
          predictionsEnabled: data.predictionsEnabled,
          summariesEnabled: data.summariesEnabled,
          scoringEnabled: data.scoringEnabled,
          anomalyEnabled: data.anomalyEnabled,
        },
      }),
    ])

    return apiOk({ ok: true })
  })
}
