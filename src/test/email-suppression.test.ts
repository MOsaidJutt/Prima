// @vitest-environment node
/**
 * Verifies the Phase 7 send-suppression wrapper in src/lib/email.ts: a
 * bounced/complained address (per src/lib/email-suppression.ts) must not
 * be re-mailed, regardless of which of the 13 exported send functions
 * is called.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => mockSend(...args) }
  },
}))

const mockIsSuppressed = vi.fn()
vi.mock('@/lib/email-suppression', () => ({
  isEmailSuppressed: (...args: unknown[]) => mockIsSuppressed(...args),
}))

import { sendOrganizationInvite } from '@/lib/email'

beforeEach(() => {
  vi.clearAllMocks()
  mockSend.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

describe('email send suppression', () => {
  it('sends normally when the recipient is not suppressed', async () => {
    mockIsSuppressed.mockResolvedValue(false)
    await sendOrganizationInvite({ to: 'ok@example.com', orgName: 'Acme', inviteToken: 'tok' })
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('skips the send when the recipient is suppressed', async () => {
    mockIsSuppressed.mockResolvedValue(true)
    const result = await sendOrganizationInvite({
      to: 'bounced@example.com',
      orgName: 'Acme',
      inviteToken: 'tok',
    })
    expect(mockSend).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })
})
