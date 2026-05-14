// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Prisma ───────────────────────────────────────────────────────────────
// We mock the entire prisma module so auth tests never touch a real database.

const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    superAdmin: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    organization: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

// ── Mock cookies ──────────────────────────────────────────────────────────────
const mockSet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: mockSet, get: vi.fn() }),
}))

// ── Mock redirect ─────────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { superAdminLogin } from '@/lib/auth/actions'
import bcrypt from 'bcryptjs'

import { BCRYPT_ROUNDS_PASSWORD as BCRYPT_ROUNDS } from '@/lib/constants'

describe('superAdminLogin', () => {
  const validHash = bcrypt.hashSync('ValidPass@1', BCRYPT_ROUNDS)

  const activeAdmin = {
    id: 'sa-uuid-1',
    email: 'admin@prima.app',
    name: 'Owner',
    role: 'OWNER' as const,
    permissions: ['*'],
    passwordHash: validHash,
    isActive: true,
    deletedAt: null,
  }

  beforeEach(() => {
    mockFindFirst.mockReset()
    mockUpdate.mockReset()
    mockSet.mockReset()
    mockUpdate.mockResolvedValue(activeAdmin)
  })

  it('returns error for unknown email', async () => {
    mockFindFirst.mockResolvedValue(null)
    const result = await superAdminLogin('nobody@example.com', 'anything')
    expect(result).toEqual({ error: 'Invalid credentials' })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('returns error for wrong password', async () => {
    mockFindFirst.mockResolvedValue(activeAdmin)
    const result = await superAdminLogin('admin@prima.app', 'WrongPassword1!')
    expect(result).toEqual({ error: 'Invalid credentials' })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('returns error for inactive admin', async () => {
    mockFindFirst.mockResolvedValue({ ...activeAdmin, isActive: false })
    const result = await superAdminLogin('admin@prima.app', 'ValidPass@1')
    expect(result).toEqual({ error: 'Invalid credentials' })
  })

  it('returns error for soft-deleted admin (C-2)', async () => {
    // The query itself filters deletedAt: null, so findFirst returns null for deleted admins
    mockFindFirst.mockResolvedValue(null)
    const result = await superAdminLogin('deleted@prima.app', 'ValidPass@1')
    expect(result).toEqual({ error: 'Invalid credentials' })
    // Verify the query included deletedAt: null filter
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    )
  })

  it('succeeds with correct credentials and sets session cookie', async () => {
    mockFindFirst.mockResolvedValue(activeAdmin)
    const result = await superAdminLogin('admin@prima.app', 'ValidPass@1')
    expect(result).toEqual({ success: true })
    expect(mockSet).toHaveBeenCalledTimes(1)
    // Verify cookie is httpOnly
    const [, , opts] = mockSet.mock.calls[0] as [string, string, Record<string, unknown>]
    expect(opts.httpOnly).toBe(true)
    expect(opts.sameSite).toBe('strict')
  })

  it('updates lastLoginAt on successful login', async () => {
    mockFindFirst.mockResolvedValue(activeAdmin)
    await superAdminLogin('admin@prima.app', 'ValidPass@1')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      })
    )
  })
})
