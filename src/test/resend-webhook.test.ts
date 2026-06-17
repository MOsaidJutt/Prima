// @vitest-environment node
/**
 * Unit tests for the Resend bounce/complaint webhook route
 * (src/app/api/webhooks/resend). Svix signature verification and the
 * suppression-list write are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }))

vi.mock('svix', () => ({
  Webhook: class {
    verify = mockVerify
  },
}))

const mockSuppressEmail = vi.fn()
vi.mock('@/lib/email-suppression', () => ({
  suppressEmail: (...args: unknown[]) => mockSuppressEmail(...args),
}))

import { POST } from '@/app/api/webhooks/resend/route'

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new Request('http://localhost:3000/api/webhooks/resend', {
    method: 'POST',
    headers,
    body: '{}',
  }) as unknown as NextRequest
}

const SVIX_HEADERS = {
  'svix-id': 'msg_test',
  'svix-timestamp': '1700000000',
  'svix-signature': 'v1,test',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_test'
  mockSuppressEmail.mockResolvedValue(undefined)
})

describe('POST /api/webhooks/resend — guards', () => {
  it('returns 503 when not configured', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    const res = await POST(makeRequest(SVIX_HEADERS))
    expect(res.status).toBe(503)
  })

  it('returns 400 when svix headers are missing', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns 400 on an invalid signature', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('bad signature')
    })
    const res = await POST(makeRequest(SVIX_HEADERS))
    expect(res.status).toBe(400)
    expect(mockSuppressEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/webhooks/resend — event handling', () => {
  it('suppresses the recipient on email.bounced', async () => {
    mockVerify.mockReturnValue({
      type: 'email.bounced',
      data: { to: ['bounced@example.com'], bounce: { message: 'mailbox full' } },
    })
    const res = await POST(makeRequest(SVIX_HEADERS))
    expect(res.status).toBe(200)
    expect(mockSuppressEmail).toHaveBeenCalledWith('bounced@example.com', 'BOUNCED', 'mailbox full')
  })

  it('suppresses the recipient on email.complained', async () => {
    mockVerify.mockReturnValue({
      type: 'email.complained',
      data: { to: ['complainer@example.com'] },
    })
    const res = await POST(makeRequest(SVIX_HEADERS))
    expect(res.status).toBe(200)
    expect(mockSuppressEmail).toHaveBeenCalledWith('complainer@example.com', 'COMPLAINED')
  })

  it('acknowledges unhandled event types without suppressing anything', async () => {
    mockVerify.mockReturnValue({
      type: 'email.delivered',
      data: { to: ['ok@example.com'] },
    })
    const res = await POST(makeRequest(SVIX_HEADERS))
    expect(res.status).toBe(200)
    expect(mockSuppressEmail).not.toHaveBeenCalled()
  })
})
