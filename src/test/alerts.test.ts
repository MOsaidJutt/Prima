// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendOpsAlertEmail = vi.fn()
vi.mock('@/lib/email', () => ({
  sendOpsAlertEmail: (...args: unknown[]) => mockSendOpsAlertEmail(...args),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { sendOnCallAlert } from '@/lib/alerts'

beforeEach(() => {
  vi.clearAllMocks()
  mockSendOpsAlertEmail.mockResolvedValue({ data: null, error: null })
  delete process.env.TWILIO_ACCOUNT_SID
  delete process.env.TWILIO_AUTH_TOKEN
  delete process.env.TWILIO_WHATSAPP_FROM
  delete process.env.ONCALL_WHATSAPP_TO
})

describe('sendOnCallAlert', () => {
  it('always sends the email alert, severity-tagged', async () => {
    await sendOnCallAlert('Queue backlog', '600 jobs waiting', 'critical')
    expect(mockSendOpsAlertEmail).toHaveBeenCalledWith({
      subject: '[CRITICAL] Queue backlog',
      body: '600 jobs waiting',
    })
  })

  it('skips WhatsApp entirely when Twilio is not configured', async () => {
    await sendOnCallAlert('Queue backlog', '600 jobs waiting')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends WhatsApp via Twilio when fully configured', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest'
    process.env.TWILIO_AUTH_TOKEN = 'token'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+1'
    process.env.ONCALL_WHATSAPP_TO = 'whatsapp:+2'
    mockFetch.mockResolvedValue({ ok: true, text: async () => '' })

    await sendOnCallAlert('Queue backlog', '600 jobs waiting', 'warning')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json')
    expect(init.method).toBe('POST')
    expect(String(init.body)).toContain('whatsapp%3A%2B2')
  })

  it('does not throw when Twilio request fails', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest'
    process.env.TWILIO_AUTH_TOKEN = 'token'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+1'
    process.env.ONCALL_WHATSAPP_TO = 'whatsapp:+2'
    mockFetch.mockRejectedValue(new Error('network down'))

    await expect(sendOnCallAlert('Queue backlog', 'oops')).resolves.toBeUndefined()
  })
})
