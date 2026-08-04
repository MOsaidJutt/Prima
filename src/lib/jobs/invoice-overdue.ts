import { prisma } from '@/lib/prisma'

/** Marks ISSUED invoices as OVERDUE when they are past their due date. */
export async function runInvoiceOverdue(): Promise<void> {
  const now = new Date()
  const result = await prisma.invoice.updateMany({
    where: {
      status: 'ISSUED',
      dueDate: { lt: now },
      deletedAt: null,
    },
    data: { status: 'OVERDUE' },
  })
  console.log(`[invoice-overdue] Marked ${result.count} invoices as OVERDUE`)
}
