import { embed, embedMany } from 'ai'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from './providers/factory'
import { logTokenUsage } from './wallet'
import type { Organization, OrganizationAISettings } from '@prisma/client'

type OrgForEmbedding = Pick<
  Organization,
  'id' | 'aiEnabled' | 'aiProvider' | 'aiApiKeyEncrypted' | 'aiModel' | 'embeddingProvider'
> & { aiSettings?: Pick<OrganizationAISettings, 'ollamaBaseUrl' | 'embeddingModel'> | null }

export async function embedText(org: OrgForEmbedding, text: string): Promise<number[]> {
  const provider = getAIProvider(org)
  const model = provider.getEmbeddingModel()
  const { embedding, usage } = await embed({ model, value: text })

  await logTokenUsage({
    organizationId: org.id,
    feature: 'embedding',
    model: org.aiModel ?? 'unknown',
    provider: org.aiProvider ?? 'unknown',
    inputTokens: usage?.tokens ?? 0,
    outputTokens: 0,
  })

  return embedding
}

export async function embedBatch(org: OrgForEmbedding, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const provider = getAIProvider(org)
  const model = provider.getEmbeddingModel()
  const { embeddings, usage } = await embedMany({ model, values: texts })

  await logTokenUsage({
    organizationId: org.id,
    feature: 'embedding',
    model: org.aiModel ?? 'unknown',
    provider: org.aiProvider ?? 'unknown',
    inputTokens: usage?.tokens ?? 0,
    outputTokens: 0,
  })

  return embeddings
}

// Retrieve top-k similar products using pgvector cosine distance
export async function findSimilarProducts(
  organizationId: string,
  queryEmbedding: number[],
  limit = 5,
  excludeProductId?: string
): Promise<Array<{ id: string; name: string; sku: string; similarity: number }>> {
  const vector = `[${queryEmbedding.join(',')}]`
  const results = await prisma.$queryRaw<
    Array<{ id: string; name: string; sku: string; similarity: number }>
  >`
    SELECT id, name, sku,
           1 - (embedding <=> ${vector}::vector) AS similarity
    FROM "Product"
    WHERE "organizationId" = ${organizationId}::uuid
      AND "deletedAt" IS NULL
      AND embedding IS NOT NULL
      AND id != ${excludeProductId ?? '00000000-0000-0000-0000-000000000000'}::uuid
    ORDER BY embedding <=> ${vector}::vector
    LIMIT ${limit}
  `
  return results
}

// Embed and upsert product descriptions into the Product.embedding column
export async function refreshProductEmbeddings(
  org: OrgForEmbedding,
  productIds?: string[]
): Promise<void> {
  const products = await prisma.product.findMany({
    where: {
      organizationId: org.id,
      deletedAt: null,
      ...(productIds ? { id: { in: productIds } } : {}),
    },
    select: { id: true, name: true, description: true, sku: true, brand: true },
  })

  if (products.length === 0) return

  const texts = products.map((p) =>
    `${p.name} ${p.sku} ${p.brand ?? ''} ${p.description ?? ''}`.trim()
  )

  const embeddings = await embedBatch(org, texts)

  for (let i = 0; i < products.length; i++) {
    const vector = `[${embeddings[i].join(',')}]`
    await prisma.$executeRaw`
      UPDATE "Product"
      SET embedding = ${vector}::vector
      WHERE id = ${products[i].id}::uuid
    `
  }
}
