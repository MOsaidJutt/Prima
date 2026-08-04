import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { subDays, startOfDay, endOfDay } from 'date-fns'

async function notifyAdminsAboutAnomaly(
  orgId: string,
  title: string,
  body: string,
  recommendationId: string
) {
  const ownerRole = await prisma.role.findFirst({
    where: { organizationId: orgId, name: 'Owner', deletedAt: null },
    include: {
      users: { where: { deletedAt: null, isActive: true }, select: { id: true }, take: 3 },
    },
  })

  for (const user of ownerRole?.users ?? []) {
    await createNotification({
      organizationId: orgId,
      userId: user.id,
      type: 'ai_recommendation',
      title,
      body,
      data: { actionUrl: '/admin/recommendations', recommendationId },
    })
  }
}

export async function runAnomalyDetection(orgId: string) {
  const now = new Date()
  const thisWeekStart = subDays(now, 7)
  const lastWeekStart = subDays(now, 14)
  const lastWeekEnd = subDays(now, 7)

  // 1. Department revenue dropped >25% week-over-week
  const departments = await prisma.department.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true, name: true },
  })

  for (const dept of departments) {
    const [thisWeekRev, lastWeekRev] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          issueDate: { gte: thisWeekStart },
          deletedAt: null,
          createdBy: { departmentId: dept.id },
        },
        _sum: { grandTotal: true },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          issueDate: { gte: lastWeekStart, lte: lastWeekEnd },
          deletedAt: null,
          createdBy: { departmentId: dept.id },
        },
        _sum: { grandTotal: true },
      }),
    ])

    const thisRev = Number(thisWeekRev._sum.grandTotal ?? 0)
    const lastRev = Number(lastWeekRev._sum.grandTotal ?? 0)

    if (lastRev > 0 && thisRev < lastRev * 0.75) {
      const dropPct = Math.round(((lastRev - thisRev) / lastRev) * 100)
      const existing = await prisma.aIRecommendation.findFirst({
        where: {
          organizationId: orgId,
          type: 'ANOMALY_REVENUE',
          entityId: dept.id,
          status: 'ACTIVE',
          createdAt: { gte: subDays(now, 1) },
        },
      })
      if (!existing) {
        const rec = await prisma.aIRecommendation.create({
          data: {
            organizationId: orgId,
            type: 'ANOMALY_REVENUE',
            severity: dropPct > 50 ? 'CRITICAL' : 'WARNING',
            title: `Revenue Drop: ${dept.name}`,
            body: `${dept.name} revenue dropped ${dropPct}% this week vs last week (${lastRev.toLocaleString('en-PK')} → ${thisRev.toLocaleString('en-PK')} PKR). Investigate immediately.`,
            entityType: 'Department',
            entityId: dept.id,
            data: { departmentId: dept.id, thisWeekRev: thisRev, lastWeekRev: lastRev, dropPct },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
        await notifyAdminsAboutAnomaly(
          orgId,
          `Revenue drop in ${dept.name}`,
          `Revenue fell ${dropPct}% this week vs last week.`,
          rec.id
        )
      }
    }
  }

  // 2. Sales reps who skipped DSR for 3+ consecutive days
  const reps = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      isActive: true,
      role: { permissions: { has: 'dsr:create' } },
    },
    select: { id: true, name: true },
  })

  for (const rep of reps) {
    let consecutiveMissed = 0
    for (let d = 1; d <= 7; d++) {
      const date = subDays(now, d)
      // Skip weekends
      const dow = date.getDay()
      if (dow === 0 || dow === 6) continue

      const count = await prisma.dSREntry.count({
        where: {
          organizationId: orgId,
          submittedById: rep.id,
          reportDate: { gte: startOfDay(date), lte: endOfDay(date) },
          deletedAt: null,
        },
      })
      if (count === 0) {
        consecutiveMissed++
      } else {
        break
      }
    }

    if (consecutiveMissed >= 3) {
      const existing = await prisma.aIRecommendation.findFirst({
        where: {
          organizationId: orgId,
          type: 'ANOMALY_DSR_SKIP',
          entityId: rep.id,
          status: 'ACTIVE',
          createdAt: { gte: subDays(now, 1) },
        },
      })
      if (!existing) {
        await prisma.aIRecommendation.create({
          data: {
            organizationId: orgId,
            type: 'ANOMALY_DSR_SKIP',
            severity: 'WARNING',
            title: `DSR Skipped: ${rep.name}`,
            body: `${rep.name} has not submitted a DSR for ${consecutiveMissed} consecutive working days. Verify with their manager.`,
            entityType: 'User',
            entityId: rep.id,
            data: { userId: rep.id, missedDays: consecutiveMissed },
            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        })
      }
    }
  }

  // 3. Product velocity changed >30% (compare last 7 days vs prior 7 days)
  const products = await prisma.product.findMany({
    where: { organizationId: orgId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, name: true, sku: true },
    take: 100,
  })

  for (const product of products) {
    const [thisWeekUnits, lastWeekUnits] = await Promise.all([
      prisma.dSRLineItem.aggregate({
        where: {
          productId: product.id,
          dsrEntry: {
            organizationId: orgId,
            status: 'APPROVED',
            reportDate: { gte: thisWeekStart },
          },
        },
        _sum: { quantity: true },
      }),
      prisma.dSRLineItem.aggregate({
        where: {
          productId: product.id,
          dsrEntry: {
            organizationId: orgId,
            status: 'APPROVED',
            reportDate: { gte: lastWeekStart, lte: lastWeekEnd },
          },
        },
        _sum: { quantity: true },
      }),
    ])

    const thisUnits = thisWeekUnits._sum.quantity ?? 0
    const lastUnits = lastWeekUnits._sum.quantity ?? 0
    if (lastUnits < 5) continue // not enough data

    const changePct = Math.abs(thisUnits - lastUnits) / lastUnits
    if (changePct > 0.3) {
      const direction = thisUnits > lastUnits ? 'spike' : 'drop'
      const existing = await prisma.aIRecommendation.findFirst({
        where: {
          organizationId: orgId,
          type: 'ANOMALY_VELOCITY',
          entityId: product.id,
          status: 'ACTIVE',
          createdAt: { gte: subDays(now, 1) },
        },
      })
      if (!existing) {
        await prisma.aIRecommendation.create({
          data: {
            organizationId: orgId,
            type: 'ANOMALY_VELOCITY',
            severity: 'INFO',
            title: `Velocity ${direction === 'spike' ? 'Spike' : 'Drop'}: ${product.name}`,
            body: `${product.name} (${product.sku}) sales ${direction === 'spike' ? 'increased' : 'decreased'} by ${Math.round(changePct * 100)}% this week vs last week (${lastUnits} → ${thisUnits} units).`,
            entityType: 'Product',
            entityId: product.id,
            data: {
              productId: product.id,
              thisWeekUnits: thisUnits,
              lastWeekUnits: lastUnits,
              changePct,
            },
            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        })
      }
    }
  }

  // 4. Single client order suddenly 3x their average
  const recentOrders = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      issueDate: { gte: subDays(now, 1) },
      deletedAt: null,
    },
    select: {
      id: true,
      invoiceNumber: true,
      grandTotal: true,
      clientId: true,
      client: { select: { companyName: true, averageOrderValue: true } },
    },
  })

  for (const invoice of recentOrders) {
    const avg = Number(invoice.client.averageOrderValue)
    const orderAmt = Number(invoice.grandTotal)
    if (avg > 0 && orderAmt > avg * 3) {
      const existing = await prisma.aIRecommendation.findFirst({
        where: {
          organizationId: orgId,
          type: 'ANOMALY_ORDER_SPIKE',
          entityId: invoice.id,
          status: 'ACTIVE',
        },
      })
      if (!existing) {
        await prisma.aIRecommendation.create({
          data: {
            organizationId: orgId,
            type: 'ANOMALY_ORDER_SPIKE',
            severity: 'WARNING',
            title: `Unusually Large Order: ${invoice.client.companyName}`,
            body: `Invoice ${invoice.invoiceNumber} from ${invoice.client.companyName} is ${orderAmt.toLocaleString('en-PK')} PKR — ${Math.round(orderAmt / avg)}x their average order of ${avg.toLocaleString('en-PK')} PKR. Verify this is intentional.`,
            entityType: 'Invoice',
            entityId: invoice.id,
            data: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              orderAmount: orderAmt,
              avgOrderValue: avg,
            },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      }
    }
  }

  console.log(`[anomaly-detection] org ${orgId}: completed`)
}

/** Runs anomaly detection for every AI-enabled org, isolating per-org failures. */
export async function runAnomalyDetectionAll(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    where: { aiEnabled: true, deletedAt: null },
    select: { id: true },
  })
  for (const org of orgs) {
    try {
      await runAnomalyDetection(org.id)
    } catch (err) {
      console.error(`[anomaly-detection] org ${org.id} failed:`, err)
    }
  }
}
