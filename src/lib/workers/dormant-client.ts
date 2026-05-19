import { Worker, Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { mean } from 'simple-statistics'

export const dormantClientQueue = new Queue('dormant-client', { connection: redisConnection })

async function runDormantClientDetection(orgId: string) {
  const clients = await prisma.client.findMany({
    where: { organizationId: orgId, deletedAt: null, status: 'ACTIVE' },
    select: {
      id: true,
      companyName: true,
      code: true,
      lastOrderDate: true,
      totalLifetimeValue: true,
      assignedRepId: true,
      invoices: {
        where: { deletedAt: null },
        select: { issueDate: true },
        orderBy: { issueDate: 'asc' },
      },
    },
  })

  if (clients.length === 0) return

  // Calculate org-average lifetime value
  const lifetimeValues = clients.map((c) => Number(c.totalLifetimeValue))
  const avgLifetimeValue = lifetimeValues.length > 0 ? mean(lifetimeValues) : 0

  const now = new Date()

  for (const client of clients) {
    try {
      const invoiceDates = client.invoices.map((i) => i.issueDate.getTime())
      if (invoiceDates.length < 2) continue

      // Calculate average gap between orders
      const gaps: number[] = []
      for (let i = 1; i < invoiceDates.length; i++) {
        gaps.push((invoiceDates[i] - invoiceDates[i - 1]) / (1000 * 60 * 60 * 24))
      }
      const avgGap = mean(gaps)

      // Current gap since last order
      const lastOrder = client.lastOrderDate ?? new Date(invoiceDates[invoiceDates.length - 1])
      const currentGap = (now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24)

      const isDormant = currentGap > avgGap * 2
      const isHighValue = Number(client.totalLifetimeValue) > avgLifetimeValue

      if (!isDormant || !isHighValue) continue

      // Check if an active recommendation already exists
      const existing = await prisma.aIRecommendation.findFirst({
        where: {
          organizationId: orgId,
          type: 'DORMANT_CLIENT',
          entityType: 'Client',
          entityId: client.id,
          status: 'ACTIVE',
        },
      })
      if (existing) continue

      const suggestion =
        currentGap > avgGap * 4
          ? 'Consider a personal call or special offer to re-engage this high-value client.'
          : 'Schedule a follow-up visit or send a check-in email to re-engage this client.'

      const rec = await prisma.aIRecommendation.create({
        data: {
          organizationId: orgId,
          type: 'DORMANT_CLIENT',
          severity: currentGap > avgGap * 4 ? 'WARNING' : 'INFO',
          title: `Dormant Client: ${client.companyName}`,
          body: `${client.companyName} (${client.code}) hasn't ordered in ${Math.round(currentGap)} days (avg gap: ${Math.round(avgGap)} days). Lifetime value: ${Number(client.totalLifetimeValue).toLocaleString('en-PK')} PKR. ${suggestion}`,
          entityType: 'Client',
          entityId: client.id,
          targetUserId: client.assignedRepId,
          data: {
            clientId: client.id,
            clientName: client.companyName,
            daysSinceOrder: Math.round(currentGap),
            avgGapDays: Math.round(avgGap),
            lifetimeValue: Number(client.totalLifetimeValue),
          },
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })

      // Notify assigned sales rep if present
      if (client.assignedRepId) {
        await createNotification({
          organizationId: orgId,
          userId: client.assignedRepId,
          type: 'ai_recommendation',
          title: `Dormant client alert: ${client.companyName}`,
          body: `${client.companyName} hasn't ordered in ${Math.round(currentGap)} days. Take action!`,
          data: { actionUrl: `/admin/recommendations`, recommendationId: rec.id },
        })
      }
    } catch (err) {
      console.error(`[dormant-client] client ${client.id}:`, err)
    }
  }

  console.log(`[dormant-client] org ${orgId}: checked ${clients.length} clients`)
}

export function startDormantClientWorker() {
  return new Worker(
    'dormant-client',
    async (job) => {
      const { orgId } = job.data as { orgId?: string }
      if (orgId) {
        await runDormantClientDetection(orgId)
      } else {
        const orgs = await prisma.organization.findMany({
          where: { aiEnabled: true, deletedAt: null },
          select: { id: true },
        })
        for (const org of orgs) {
          await runDormantClientDetection(org.id)
        }
      }
    },
    { connection: redisConnection, concurrency: 1 }
  )
}
