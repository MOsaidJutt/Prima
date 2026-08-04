// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { format } from 'date-fns'

const { mockPrisma, mockSendPaymentReminderEmail } = vi.hoisted(() => ({
  mockPrisma: {
    invoice: { findMany: vi.fn(), findFirst: vi.fn() },
    paymentReminder: { findFirst: vi.fn(), create: vi.fn() },
  },
  mockSendPaymentReminderEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/email', () => ({
  sendPaymentReminderEmail: (...args: unknown[]) => mockSendPaymentReminderEmail(...args),
}))

import {
  runPaymentReminderSweep,
  sendReminderForInvoice,
  REMINDER_OFFSETS,
} from '@/lib/jobs/payment-reminder'

const ORG = 'org-1'

function invoiceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    organizationId: ORG,
    status: 'ISSUED',
    invoiceNumber: 'INV-001',
    grandTotal: 1000,
    paidAmount: 250,
    dueDate: new Date('2026-08-01'),
    client: { companyName: 'Acme Ltd', contactName: 'Ayesha', email: 'ayesha@acme.example' },
    organization: { name: 'Prima Demo' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.invoice.findMany.mockResolvedValue([])
  mockPrisma.paymentReminder.findFirst.mockResolvedValue(null)
  mockPrisma.paymentReminder.create.mockResolvedValue({})
  mockPrisma.invoice.findFirst.mockResolvedValue(invoiceFixture())
})

describe('sendReminderForInvoice', () => {
  const job = {
    invoiceId: 'inv-1',
    organizationId: ORG,
    daysOffset: 0,
    scheduledAt: new Date('2026-08-01').toISOString(),
  }

  it('sends the reminder and logs it', async () => {
    await sendReminderForInvoice(job)

    expect(mockSendPaymentReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ayesha@acme.example',
        clientName: 'Ayesha',
        invoiceNumber: 'INV-001',
        balance: 750,
      })
    )
    expect(mockPrisma.paymentReminder.create).toHaveBeenCalled()
  })

  it('does not email twice for the same invoice and offset', async () => {
    mockPrisma.paymentReminder.findFirst.mockResolvedValue({ id: 'existing' })

    await sendReminderForInvoice(job)

    expect(mockSendPaymentReminderEmail).not.toHaveBeenCalled()
    expect(mockPrisma.paymentReminder.create).not.toHaveBeenCalled()
  })

  it('skips paid invoices', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(invoiceFixture({ status: 'PAID' }))

    await sendReminderForInvoice(job)

    expect(mockSendPaymentReminderEmail).not.toHaveBeenCalled()
  })

  it('skips clients with no email address', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(
      invoiceFixture({
        client: { companyName: 'Acme Ltd', contactName: 'Ayesha', email: null },
      })
    )

    await sendReminderForInvoice(job)

    expect(mockSendPaymentReminderEmail).not.toHaveBeenCalled()
    expect(mockPrisma.paymentReminder.create).not.toHaveBeenCalled()
  })
})

describe('runPaymentReminderSweep', () => {
  it('queries one due-date window per reminder offset', async () => {
    await runPaymentReminderSweep(new Date('2026-08-04T09:00:00Z'))

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledTimes(REMINDER_OFFSETS.length)
  })

  it('never picks up paid, cancelled, or draft invoices', async () => {
    await runPaymentReminderSweep(new Date('2026-08-04T09:00:00Z'))

    for (const call of mockPrisma.invoice.findMany.mock.calls) {
      expect(call[0].where.status.notIn).toEqual(
        expect.arrayContaining(['PAID', 'CANCELLED', 'DRAFT'])
      )
      expect(call[0].where.deletedAt).toBeNull()
    }
  })

  it('looks for invoices due `offset` days from today', async () => {
    // A +7 reminder on 2026-08-04 targets invoices that were due 2026-07-28.
    // Formatted in local time because the sweep uses local day boundaries
    // (production servers run UTC); toISOString would shift the day.
    await runPaymentReminderSweep(new Date('2026-08-04T09:00:00Z'))

    const windows = mockPrisma.invoice.findMany.mock.calls.map((call) =>
      format(call[0].where.dueDate.gte, 'yyyy-MM-dd')
    )

    expect(windows).toContain('2026-07-28') // offset +7
    expect(windows).toContain('2026-08-07') // offset -3 (3 days before due)
    expect(windows).toContain('2026-08-04') // offset 0 (due today)
  })

  it('sends a reminder for each matched invoice', async () => {
    mockPrisma.invoice.findMany
      .mockResolvedValueOnce([{ id: 'inv-1', organizationId: ORG }])
      .mockResolvedValue([])

    await runPaymentReminderSweep(new Date('2026-08-04T09:00:00Z'))

    expect(mockSendPaymentReminderEmail).toHaveBeenCalledTimes(1)
  })

  it('keeps going when one invoice fails', async () => {
    mockPrisma.invoice.findMany
      .mockResolvedValueOnce([
        { id: 'inv-1', organizationId: ORG },
        { id: 'inv-2', organizationId: ORG },
      ])
      .mockResolvedValue([])
    mockSendPaymentReminderEmail.mockRejectedValueOnce(new Error('smtp down'))

    await expect(runPaymentReminderSweep(new Date('2026-08-04T09:00:00Z'))).resolves.toBeUndefined()
    expect(mockSendPaymentReminderEmail).toHaveBeenCalledTimes(2)
  })
})
