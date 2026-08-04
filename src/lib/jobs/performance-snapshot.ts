import { prisma } from '@/lib/prisma'

/** Runs nightly; generates a PerformanceSnapshot for every active sales rep. */
export async function runPerformanceSnapshots(): Promise<void> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const dayEnd = new Date(yesterday.getTime() + 86400000)

  const orgs = await prisma.organization.findMany({
    where: { status: { in: ['TRIAL', 'ACTIVE'] }, deletedAt: null },
    select: { id: true },
  })

  for (const org of orgs) {
    const reps = await prisma.user.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
        isActive: true,
        role: { name: 'Sales Rep' },
      },
      select: { id: true },
    })

    for (const rep of reps) {
      const existing = await prisma.performanceSnapshot.findFirst({
        where: { organizationId: org.id, userId: rep.id, snapshotDate: yesterday },
      })
      if (existing) continue

      const [dsrs, invoiceSums, payments] = await Promise.all([
        prisma.dSREntry.findMany({
          where: {
            organizationId: org.id,
            submittedById: rep.id,
            reportDate: { gte: yesterday, lt: dayEnd },
            deletedAt: null,
          },
          select: { status: true },
        }),
        prisma.invoice.aggregate({
          where: {
            organizationId: org.id,
            createdById: rep.id,
            issueDate: { gte: yesterday, lt: dayEnd },
            status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] },
            deletedAt: null,
          },
          _sum: { grandTotal: true },
        }),
        prisma.payment.aggregate({
          where: {
            organizationId: org.id,
            recordedById: rep.id,
            paymentDate: { gte: yesterday, lt: dayEnd },
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
      ])

      await prisma.performanceSnapshot.create({
        data: {
          organizationId: org.id,
          userId: rep.id,
          snapshotDate: yesterday,
          dsrCount: dsrs.length,
          approvedDSRs: dsrs.filter((d) => d.status === 'APPROVED').length,
          rejectedDSRs: dsrs.filter((d) => d.status === 'REJECTED').length,
          totalRevenue: Number(invoiceSums._sum.grandTotal ?? 0),
          totalInvoiced: Number(invoiceSums._sum.grandTotal ?? 0),
          totalCollected: Number(payments._sum.amount ?? 0),
          visitCount: dsrs.length,
        },
      })
    }
  }
  console.log('[performance-snapshot] Snapshots generated for all orgs')
}
