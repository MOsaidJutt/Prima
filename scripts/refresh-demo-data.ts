/**
 * Rolls the seeded demo history forward so it ends today.
 *
 * `prisma/seed.ts` generates 90 days of DSRs, invoices and payments relative to
 * the moment it runs. Weeks later every dashboard with a 7/30-day window renders
 * empty, which makes the app look dead in demos and screen recordings.
 *
 * This shifts every transactional timestamp by the gap between the newest DSR
 * and today, so relationships (payment after invoice, invoice after DSR) and
 * invoice numbers are preserved exactly — nothing is deleted and nothing
 * collides. It also puts the demo orgs back into a healthy billing state, since
 * a lapsed trial or a stale billing date would otherwise be suspended by the
 * subscription-lifecycle job.
 *
 * Safe to re-run: the shift is recomputed each time, and is a no-op if the data
 * already ends today.
 *
 *   DATABASE_URL="postgres://..." npx tsx scripts/refresh-demo-data.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DAY_MS = 86_400_000

// Transactional history only. Config/entity tables (Product, Role, User,
// BillingPlan…) keep their original createdAt — an older date there correctly
// reads as "this account has been set up a while".
const SHIFT_COLUMNS: Record<string, string[]> = {
  DSREntry: ['reportDate', 'approvedAt', 'followUpDate', 'createdAt', 'updatedAt'],
  DSRLineItem: ['createdAt', 'updatedAt'],
  Invoice: [
    'issueDate',
    'dueDate',
    'emailSentAt',
    'openedAt',
    'pdfGeneratedAt',
    'createdAt',
    'updatedAt',
  ],
  InvoiceLineItem: ['createdAt', 'updatedAt'],
  Payment: ['paymentDate', 'createdAt', 'updatedAt'],
  PerformanceSnapshot: ['snapshotDate', 'createdAt', 'updatedAt'],
  Client: ['firstOrderDate', 'lastOrderDate'],
  InventoryTransaction: ['createdAt', 'updatedAt'],
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

async function main() {
  const { _max } = await prisma.dSREntry.aggregate({ _max: { reportDate: true } })
  const newest = _max.reportDate

  if (!newest) {
    console.log('No DSR data found — run `npx prisma db seed` first.')
    return
  }

  const now = new Date()
  const shiftDays = Math.floor((now.getTime() - newest.getTime()) / DAY_MS)

  console.log(`newest DSR: ${day(newest)}   today: ${day(now)}   shift: ${shiftDays} days`)

  if (shiftDays <= 0) {
    console.log('Demo data already ends today — nothing to shift.')
    return
  }

  await prisma.$transaction(
    async (tx) => {
      for (const [table, columns] of Object.entries(SHIFT_COLUMNS)) {
        const sets = columns.map((c) => `"${c}" = "${c}" + INTERVAL '${shiftDays} days'`).join(', ')
        const rows = await tx.$executeRawUnsafe(`UPDATE "${table}" SET ${sets}`)
        console.log(`  ${table}: ${rows} rows`)
      }

      // Targets should cover the current month, not the month the seed ran.
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      await tx.salesTarget.updateMany({ data: { periodStart: monthStart, periodEnd: monthEnd } })

      // Keep promo codes usable while demoing billing.
      const nextYear = new Date(now.getTime() + 365 * DAY_MS)
      await tx.coupon.updateMany({ data: { validFrom: monthStart, validUntil: nextYear } })
      await tx.promotion.updateMany({ data: { startsAt: monthStart, endsAt: nextYear } })

      // Without this, subscription-lifecycle suspends the trial org and pushes
      // the active org to PAST_DUE on its next run.
      await tx.organization.updateMany({
        where: { status: 'TRIAL' },
        data: {
          trialEndsAt: new Date(now.getTime() + 10 * DAY_MS),
          pastDueAt: null,
          suspendedAt: null,
          gracePeriodEndsAt: null,
        },
      })
      await tx.organization.updateMany({
        where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
        data: {
          status: 'ACTIVE',
          nextBillingDate: new Date(now.getTime() + 20 * DAY_MS),
          pastDueAt: null,
          suspendedAt: null,
          gracePeriodEndsAt: null,
        },
      })
    },
    // Remote database, ~700 rows across 8 tables: the 5s default is not enough.
    { timeout: 120_000, maxWait: 20_000 }
  )

  const since = (days: number) => new Date(now.getTime() - days * DAY_MS)
  console.log('\nAfter:')
  console.log(
    '  DSRs last 7d    ',
    await prisma.dSREntry.count({ where: { reportDate: { gte: since(7) } } })
  )
  console.log(
    '  DSRs last 30d   ',
    await prisma.dSREntry.count({ where: { reportDate: { gte: since(30) } } })
  )
  console.log(
    '  Invoices last 30d',
    await prisma.invoice.count({ where: { issueDate: { gte: since(30) } } })
  )
  console.log(
    '  Payments last 30d',
    await prisma.payment.count({ where: { paymentDate: { gte: since(30) } } })
  )
}

main()
  .catch((err) => {
    console.error('refresh-demo-data failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
