import { Worker, Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai/providers/factory'
import { logTokenUsage } from '@/lib/ai/wallet'
import { generateText } from 'ai'
import { linearRegression, linearRegressionLine, mean } from 'simple-statistics'
import { subDays } from 'date-fns'

export const inventoryPredictionQueue = new Queue('inventory-prediction', {
  connection: redisConnection,
})

interface DailySales {
  date: Date
  quantity: number
}

function forecastDemand(
  sales: DailySales[],
  days: number
): { demand: number; trend: 'increasing' | 'decreasing' | 'stable'; confidence: number } {
  if (sales.length < 7) return { demand: 0, trend: 'stable', confidence: 0 }

  // Encode dates as numeric x values
  const sorted = [...sales].sort((a, b) => a.date.getTime() - b.date.getTime())
  const pairs = sorted.map((s, i) => [i, s.quantity] as [number, number])

  const regression = linearRegression(pairs)
  const regressionLine = linearRegressionLine(regression)

  const avgDailyQty = mean(sorted.map((s) => s.quantity))
  const projectedDaily = Math.max(0, regressionLine(sorted.length + days / 2))
  const demand = Math.round(projectedDaily * days)

  // Trend direction from slope
  const trend =
    Math.abs(regression.m) < 0.05 * avgDailyQty
      ? 'stable'
      : regression.m > 0
        ? 'increasing'
        : 'decreasing'

  // Confidence based on how tightly actual matches regression
  const residuals = sorted.map((s, i) => Math.abs(s.quantity - regressionLine(i)))
  const avgResidual = mean(residuals)
  const confidence = Math.min(1, Math.max(0, 1 - avgResidual / (avgDailyQty || 1)))

  return { demand, trend, confidence: Math.round(confidence * 100) / 100 }
}

async function runPredictionForOrg(orgId: string) {
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
        select: { ollamaBaseUrl: true, embeddingModel: true, predictionsEnabled: true },
      },
    },
  })

  if (!org?.aiEnabled || !org.aiSettings?.predictionsEnabled) return

  // Find products with >=60 days of sales history
  const cutoff = subDays(new Date(), 60)
  const products = await prisma.product.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      dsrLineItems: {
        some: {
          dsrEntry: {
            reportDate: { lte: cutoff },
            status: 'APPROVED',
          },
        },
      },
    },
    select: { id: true, name: true, sku: true, reorderLevel: true },
  })

  if (products.length === 0) return

  // Load AI provider once
  let aiProvider: ReturnType<typeof getAIProvider> | null = null
  try {
    aiProvider = getAIProvider(org)
  } catch {
    // If no provider configured, skip LLM explanations
  }

  for (const product of products) {
    try {
      // Aggregate daily sales for this product
      const salesData = await prisma.$queryRaw<Array<{ sale_date: Date; total_qty: number }>>`
        SELECT DATE(d."reportDate") AS sale_date,
               SUM(l.quantity)::int AS total_qty
        FROM "DSRLineItem" l
        JOIN "DSREntry" d ON d.id = l."dsrEntryId"
        WHERE l."productId" = ${product.id}::uuid
          AND d."organizationId" = ${orgId}::uuid
          AND d.status = 'APPROVED'
          AND d."reportDate" >= ${subDays(new Date(), 90)}
        GROUP BY DATE(d."reportDate")
        ORDER BY DATE(d."reportDate")
      `

      if (salesData.length < 7) continue

      const dailySales: DailySales[] = salesData.map((s) => ({
        date: new Date(s.sale_date),
        quantity: Number(s.total_qty),
      }))

      const f30 = forecastDemand(dailySales, 30)
      const f60 = forecastDemand(dailySales, 60)
      const f90 = forecastDemand(dailySales, 90)

      // Current stock
      const stockAgg = await prisma.inventoryStock.aggregate({
        where: { product: { id: product.id }, organizationId: orgId },
        _sum: { quantity: true },
      })
      const currentStock = stockAgg._sum.quantity ?? 0

      // Daily consumption rate
      const avgDailyRate = mean(dailySales.map((s) => s.quantity))
      const daysOfStock = avgDailyRate > 0 ? currentStock / avgDailyRate : 999
      const stockoutRiskDate =
        daysOfStock < 30 ? new Date(Date.now() + daysOfStock * 86400000) : null
      const reorderByDate = new Date(Date.now() + Math.max(0, daysOfStock - 7) * 86400000)
      const reorderQty = Math.max(product.reorderLevel, Math.round(f30.demand * 1.2))

      // LLM explanation
      let explanation: string | null = null
      if (aiProvider) {
        try {
          const model = aiProvider.getLanguageModel()
          const { text, usage } = await generateText({
            model,
            prompt: `Product: ${product.name} (${product.sku})
30-day demand forecast: ${f30.demand} units
Trend: ${f30.trend}
Current stock: ${currentStock} units
Recommended reorder: ${reorderQty} units by ${reorderByDate.toLocaleDateString()}

Write a 2-sentence plain-English explanation of this inventory recommendation.`,
            maxOutputTokens: 100,
          })
          explanation = text

          await logTokenUsage({
            organizationId: orgId,
            feature: 'prediction',
            model: org.aiModel ?? 'unknown',
            provider: org.aiProvider ?? 'unknown',
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            referenceType: 'InventoryPrediction',
            referenceId: product.id,
          })
        } catch {
          // Non-fatal — proceed without explanation
        }
      }

      await prisma.inventoryPrediction.upsert({
        where: { organizationId_productId: { organizationId: orgId, productId: product.id } },
        create: {
          organizationId: orgId,
          productId: product.id,
          demand30Days: f30.demand,
          demand60Days: f60.demand,
          demand90Days: f90.demand,
          reorderQty,
          reorderByDate,
          stockoutRiskDate,
          trend: f30.trend,
          confidence: f30.confidence,
          explanation,
        },
        update: {
          demand30Days: f30.demand,
          demand60Days: f60.demand,
          demand90Days: f90.demand,
          reorderQty,
          reorderByDate,
          stockoutRiskDate,
          trend: f30.trend,
          confidence: f30.confidence,
          explanation,
          generatedAt: new Date(),
          isApproved: false, // reset approval on regeneration
        },
      })
    } catch (err) {
      console.error(`[inventory-prediction] product ${product.id}:`, err)
    }
  }

  console.log(`[inventory-prediction] org ${orgId}: processed ${products.length} products`)
}

export function startInventoryPredictionWorker() {
  return new Worker(
    'inventory-prediction',
    async (job) => {
      const { orgId } = job.data as { orgId?: string }

      if (orgId) {
        try {
          await runPredictionForOrg(orgId)
        } catch (err) {
          console.error(`[inventory-prediction] org ${orgId} failed:`, err)
          throw err // re-throw so BullMQ marks job as failed and retries
        }
      } else {
        const orgs = await prisma.organization.findMany({
          where: { aiEnabled: true, deletedAt: null },
          select: { id: true },
        })
        for (const org of orgs) {
          try {
            await runPredictionForOrg(org.id)
          } catch (err) {
            console.error(`[inventory-prediction] org ${org.id} failed:`, err)
            // continue with next org rather than aborting the whole batch
          }
        }
      }
    },
    { connection: redisConnection, concurrency: 1 }
  )
}
