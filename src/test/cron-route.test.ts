// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRun } = vi.hoisted(() => ({ mockRun: vi.fn() }))

vi.mock('@/lib/jobs', () => ({
  JOBS: {
    'invoice-overdue': { run: mockRun, schedule: '0 1 * * *', description: 'test job' },
  },
  isJobName: (value: string) => value === 'invoice-overdue',
}))

import { GET, POST } from '@/app/api/cron/[job]/route'

const SECRET = 'test-cron-secret-value'

function request(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/cron/invoice-overdue', { headers })
}

function params(job = 'invoice-overdue') {
  return { params: Promise.resolve({ job }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRun.mockResolvedValue(undefined)
  process.env.CRON_SECRET = SECRET
})

describe('GET /api/cron/[job]', () => {
  it('refuses to run anything when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(request({ authorization: `Bearer ${SECRET}` }), params())

    expect(res.status).toBe(503)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('rejects a request with no secret', async () => {
    const res = await GET(request(), params())

    expect(res.status).toBe(401)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret', async () => {
    const res = await GET(request({ authorization: 'Bearer wrong-secret-value' }), params())

    expect(res.status).toBe(401)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('rejects a secret that is a prefix of the real one', async () => {
    const res = await GET(request({ authorization: `Bearer ${SECRET.slice(0, 5)}` }), params())

    expect(res.status).toBe(401)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('runs the job with a valid Authorization header', async () => {
    const res = await GET(request({ authorization: `Bearer ${SECRET}` }), params())

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ job: 'invoice-overdue', status: 'ok' })
    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it('accepts the x-cron-secret header', async () => {
    const res = await GET(request({ 'x-cron-secret': SECRET }), params())

    expect(res.status).toBe(200)
    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it('404s an unknown job name without running anything', async () => {
    const res = await GET(request({ 'x-cron-secret': SECRET }), params('not-a-job'))

    expect(res.status).toBe(404)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('returns 500 when the job throws', async () => {
    mockRun.mockRejectedValue(new Error('boom'))
    const res = await GET(request({ 'x-cron-secret': SECRET }), params())

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ status: 'error' })
  })
})

describe('POST /api/cron/[job]', () => {
  it('works the same as GET for schedulers that POST', async () => {
    const res = await POST(request({ 'x-cron-secret': SECRET }), params())

    expect(res.status).toBe(200)
    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it('still rejects an unauthenticated POST', async () => {
    const res = await POST(request(), params())

    expect(res.status).toBe(401)
    expect(mockRun).not.toHaveBeenCalled()
  })
})
