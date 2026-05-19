import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai/providers/factory'
import { findSimilarProducts, embedText } from '@/lib/ai/embeddings'
import { generateText } from 'ai'
import { logTokenUsage } from '@/lib/ai/wallet'

export async function GET(req: NextRequest) {
  return withTenantApi(req, null, async ({ ctx, user }) => {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')
    if (!clientId) return apiError('clientId required')

    const orgId = ctx.organizationId

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

    if (!org?.aiEnabled) return apiError('AI features disabled.', 403)

    const boughtProductIds = await prisma.invoiceLineItem.findMany({
      where: {
        invoice: { clientId, organizationId: orgId, deletedAt: null },
        productId: { not: null },
      },
      select: { productId: true },
      distinct: ['productId'],
    })
    const boughtIds = boughtProductIds.map((b) => b.productId).filter(Boolean) as string[]

    const recentProduct = boughtIds[0]
      ? await prisma.product.findUnique({
          where: { id: boughtIds[0] },
          select: { name: true, description: true, sku: true, brand: true },
        })
      : null

    if (!recentProduct) {
      return apiOk({ suggestions: [], reason: 'No purchase history.' })
    }

    const queryText =
      `${recentProduct.name} ${recentProduct.brand ?? ''} ${recentProduct.description ?? ''}`.trim()

    let suggestions: Array<{ id: string; name: string; sku: string; similarity: number }> = []
    let rationale = ''

    try {
      const embedding = await embedText(org, queryText)
      const similar = await findSimilarProducts(orgId, embedding, 8)
      suggestions = similar.filter((s) => !boughtIds.includes(s.id)).slice(0, 5)

      if (suggestions.length > 0) {
        const provider = getAIProvider(org)
        const model = provider.getLanguageModel()
        const { text, usage } = await generateText({
          model,
          prompt: `Client recently purchased: ${recentProduct.name}
Suggested products: ${suggestions.map((s) => s.name).join(', ')}
Write a 1-sentence rationale for why these products are good upsell/cross-sell options.`,
        })
        rationale = text

        await logTokenUsage({
          organizationId: orgId,
          userId: user.id,
          feature: 'summary',
          model: org.aiModel ?? 'unknown',
          provider: org.aiProvider ?? 'unknown',
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
        })
      }
    } catch {
      const topProducts = await prisma.invoiceLineItem.groupBy({
        by: ['productId'],
        where: { invoice: { organizationId: orgId, deletedAt: null }, productId: { not: null } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      })
      const productIds = topProducts.map((p) => p.productId).filter(Boolean) as string[]
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        select: { id: true, name: true, sku: true },
      })
      suggestions = products.map((p) => ({ ...p, similarity: 0.5 }))
      rationale = 'Based on top-selling products.'
    }

    return apiOk({ suggestions, rationale })
  })
}
