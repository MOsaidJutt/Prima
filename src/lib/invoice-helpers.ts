import { prisma } from '@/lib/prisma'
import type { PrismaClient } from '@prisma/client'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/**
 * Generates the next invoice number for an organization atomically.
 *
 * Uses an InvoiceNumberSequence row per org with an atomic UPDATE ... SET seq = seq + 1,
 * avoiding the TOCTOU race that a read-then-write pattern produces. The upsert is safe
 * because PostgreSQL's INSERT ... ON CONFLICT DO UPDATE is a single atomic statement.
 *
 * Pass a transaction client `tx` when calling inside prisma.$transaction() so the
 * sequence increment and the invoice insert share the same transaction.
 */
export async function generateInvoiceNumber(orgId: string, tx?: Tx): Promise<string> {
  const db = (tx ?? prisma) as PrismaClient

  // Atomic increment — single UPDATE statement, no read-then-write
  const seq = await db.invoiceNumberSequence.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, seq: 1 },
    update: { seq: { increment: 1 } },
    select: { seq: true },
  })

  const template = await db.invoiceTemplate.findFirst({
    where: { organizationId: orgId, isDefault: true, deletedAt: null },
    select: {
      invoiceNumberPrefix: true,
      invoiceNumberPadding: true,
      invoiceNumberIncludeYear: true,
    },
  })

  const prefix = template?.invoiceNumberPrefix ?? 'INV'
  const padding = template?.invoiceNumberPadding ?? 4
  const includeYear = template?.invoiceNumberIncludeYear ?? true
  const year = new Date().getFullYear()

  return includeYear
    ? `${prefix}-${year}-${String(seq.seq).padStart(padding, '0')}`
    : `${prefix}-${String(seq.seq).padStart(padding, '0')}`
}
