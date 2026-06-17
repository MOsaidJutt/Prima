// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendOnCallAlert = vi.fn()
vi.mock('@/lib/alerts', () => ({
  sendOnCallAlert: (...args: unknown[]) => mockSendOnCallAlert(...args),
}))

const { mockGetJobCounts } = vi.hoisted(() => ({ mockGetJobCounts: vi.fn() }))

vi.mock('@/lib/redis', () => ({ redisConnection: {} }))
vi.mock('bullmq', () => ({
  Queue: class {
    getJobCounts = (...args: unknown[]) => mockGetJobCounts(...args)
  },
  Worker: class {},
}))

import { checkQueueDepths } from '@/lib/workers/queue-monitor'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetJobCounts.mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0 })
})

describe('checkQueueDepths', () => {
  it('sends no alerts when every queue is under threshold', async () => {
    await checkQueueDepths()
    expect(mockSendOnCallAlert).not.toHaveBeenCalled()
  })

  it('alerts (warning) when a queue backlog exceeds the waiting threshold', async () => {
    mockGetJobCounts.mockResolvedValueOnce({ waiting: 600, active: 2, failed: 0, delayed: 0 })
    await checkQueueDepths()
    expect(mockSendOnCallAlert).toHaveBeenCalledWith(
      expect.stringContaining('backlog'),
      expect.stringContaining('600 jobs waiting'),
      'warning'
    )
  })

  it('alerts (critical) when a queue has too many failed jobs', async () => {
    mockGetJobCounts.mockResolvedValueOnce({ waiting: 0, active: 0, failed: 15, delayed: 0 })
    await checkQueueDepths()
    expect(mockSendOnCallAlert).toHaveBeenCalledWith(
      expect.stringContaining('failed jobs'),
      expect.stringContaining('15 failed jobs'),
      'critical'
    )
  })

  it('continues checking other queues if one throws', async () => {
    mockGetJobCounts
      .mockRejectedValueOnce(new Error('redis down'))
      .mockResolvedValue({ waiting: 0, active: 0, failed: 0, delayed: 0 })
    await expect(checkQueueDepths()).resolves.toBeUndefined()
  })
})
