import { prisma } from '@/lib/prisma'

// Weights per spec: on-time% 40%, avg-days-late 30%, defaults 20%, recent-trend 10%
export async function recalculatePaymentScore(clientId: string, organizationId: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      clientId,
      organizationId,
      deletedAt: null,
      status: { in: ['PAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    },
    select: {
      dueDate: true,
      status: true,
      payments: {
        where: { deletedAt: null },
        select: { paymentDate: true, amount: true },
        orderBy: { paymentDate: 'asc' },
      },
    },
  })

  if (invoices.length === 0) return

  let onTimeCount = 0
  let lateCount = 0
  let totalDaysLate = 0
  let defaultCount = 0
  const recentDaysLate: number[] = [] // last 5 payments

  for (const invoice of invoices) {
    if (!invoice.dueDate) continue

    const firstPayment = invoice.payments[0]
    if (!firstPayment) {
      if (invoice.status === 'OVERDUE') defaultCount++
      continue
    }

    const daysLate = Math.max(
      0,
      Math.floor(
        (firstPayment.paymentDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    )

    if (daysLate === 0) {
      onTimeCount++
    } else {
      lateCount++
      totalDaysLate += daysLate
    }

    recentDaysLate.push(daysLate)
  }

  const totalPayments = onTimeCount + lateCount
  const onTimePct = totalPayments > 0 ? onTimeCount / totalPayments : 0
  const avgDaysLate = lateCount > 0 ? totalDaysLate / lateCount : 0

  // Recent trend: compare last 5 vs prior 5
  const lastFive = recentDaysLate.slice(-5)
  const priorFive = recentDaysLate.slice(-10, -5)
  const lastAvg = lastFive.length > 0 ? lastFive.reduce((a, b) => a + b, 0) / lastFive.length : 0
  const priorAvg =
    priorFive.length > 0 ? priorFive.reduce((a, b) => a + b, 0) / priorFive.length : lastAvg
  // Lower days late = better trend = higher score
  const trendScore =
    priorAvg > 0 ? Math.max(0, Math.min(100, 100 - ((lastAvg - priorAvg) / priorAvg) * 50)) : 75

  // Component scores (0-100)
  const onTimeScore = onTimePct * 100
  const daysLateScore = Math.max(0, 100 - avgDaysLate * 2) // -2 pts per day late
  const defaultScore = Math.max(0, 100 - defaultCount * 25) // -25 pts per default

  // Weighted composite
  const score = Math.round(
    onTimeScore * 0.4 + daysLateScore * 0.3 + defaultScore * 0.2 + trendScore * 0.1
  )

  const label =
    score >= 85
      ? 'EXCELLENT'
      : score >= 70
        ? 'GOOD'
        : score >= 50
          ? 'AVERAGE'
          : score >= 30
            ? 'RISKY'
            : 'DEFAULTER'

  await prisma.client.update({
    where: { id: clientId },
    data: { paymentBehaviorScore: score, paymentBehaviorLabel: label },
  })
}
