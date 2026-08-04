import { prisma } from '@/lib/prisma'
import { renderPlatformInvoicePdf } from '@/lib/pdf/platform-invoice-pdf'
import { sendPlatformInvoiceEmail } from '@/lib/email'

/**
 * Aggregates an org's un-invoiced PlatformPayment records (subscription fee,
 * setup fee, top-ups, manual adjustments) into a single OrganizationInvoice,
 * renders a Prima-branded PDF, and emails it to the org's billing contact.
 */
export async function generateInvoiceForOrg(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      billingEmail: true,
      plan: true,
      subscriptionStart: true,
      createdAt: true,
    },
  })
  if (!org) return

  const unbilled = await prisma.platformPayment.findMany({
    where: { organizationId, invoiceId: null, status: { in: ['SUCCEEDED', 'PENDING'] } },
    orderBy: { createdAt: 'asc' },
  })
  if (unbilled.length === 0) return

  let subscriptionFee = 0
  let setupFee = 0
  let tokenTopUpTotal = 0
  let discount = 0

  for (const p of unbilled) {
    const amount = Number(p.amount)
    switch (p.type) {
      case 'SUBSCRIPTION':
        subscriptionFee += amount
        break
      case 'SETUP_FEE':
        setupFee += amount
        break
      case 'TOPUP':
        tokenTopUpTotal += amount
        break
      case 'MANUAL_ADJUSTMENT':
        if (amount >= 0) subscriptionFee += amount
        else discount += Math.abs(amount)
        break
    }
  }

  const totalAmount = Math.max(0, subscriptionFee + setupFee + tokenTopUpTotal - discount)

  const lastInvoice = await prisma.organizationInvoice.findFirst({
    where: { organizationId, deletedAt: null },
    orderBy: { periodEnd: 'desc' },
    select: { periodEnd: true },
  })

  const periodEnd = new Date()
  const periodStart = lastInvoice?.periodEnd ?? org.subscriptionStart ?? org.createdAt
  const dueDate = new Date(periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000)
  const allPaid = unbilled.every((p) => p.status === 'SUCCEEDED')
  const invoiceNumber = `PRIMA-${periodEnd.getFullYear()}${String(periodEnd.getMonth() + 1).padStart(2, '0')}-${organizationId.slice(0, 8).toUpperCase()}`

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.organizationInvoice.create({
      data: {
        invoiceNumber,
        organizationId,
        periodStart,
        periodEnd,
        issueDate: periodEnd,
        dueDate,
        subscriptionFee,
        setupFee,
        tokenTopUpTotal,
        discount,
        totalAmount,
        status: allPaid ? 'PAID' : 'ISSUED',
        paidAt: allPaid ? periodEnd : null,
      },
    })

    await tx.platformPayment.updateMany({
      where: { id: { in: unbilled.map((p) => p.id) } },
      data: { invoiceId: created.id },
    })

    return created
  })

  try {
    const pdfBuffer = await renderPlatformInvoicePdf({
      invoice,
      org: { name: org.name, plan: org.plan, billingEmail: org.billingEmail, email: org.email },
    })

    await sendPlatformInvoiceEmail({
      to: org.billingEmail ?? org.email,
      orgName: org.name,
      invoiceNumber: invoice.invoiceNumber,
      total: totalAmount,
      periodStart,
      periodEnd,
      pdfBuffer,
    })
  } catch (err) {
    console.error(`[platform-invoicing] failed to email invoice for org ${organizationId}:`, err)
  }

  console.log(
    `[platform-invoicing] generated ${invoice.invoiceNumber} for org ${organizationId} (PKR ${totalAmount.toLocaleString()})`
  )
}

/** Generates invoices for every org that has un-invoiced platform payments. */
export async function runPlatformInvoicing(): Promise<void> {
  const pending = await prisma.platformPayment.findMany({
    where: { invoiceId: null, status: { in: ['SUCCEEDED', 'PENDING'] } },
    select: { organizationId: true },
    distinct: ['organizationId'],
  })

  for (const { organizationId } of pending) {
    try {
      await generateInvoiceForOrg(organizationId)
    } catch (err) {
      console.error(`[platform-invoicing] org ${organizationId} failed:`, err)
    }
  }
}
