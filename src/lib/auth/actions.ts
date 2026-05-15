'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSuperAdminToken, setSessionCookie, clearSessionCookie } from '@/lib/auth/session'
import { checkLoginRateLimitByIP } from '@/lib/rate-limit'

// ── Super Admin Login ──────────────────────────────────────────────────────

export async function superAdminLogin(email: string, password: string) {
  // C-1: rate-limit by IP — server actions don't expose Request, so read headers directly
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ??
    headersList.get('x-real-ip') ??
    'anonymous'
  const rateLimit = await checkLoginRateLimitByIP(ip)
  if (rateLimit) return { error: rateLimit.error as string }

  const admin = await prisma.superAdmin.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
  })

  if (!admin || !admin.isActive) {
    // L-5: log failed login attempt (fire-and-forget; never block the response)
    prisma.platformAuditLog
      .create({
        data: {
          action: 'LOGIN_FAILED',
          entity: 'SuperAdmin',
          newValue: { email: email.toLowerCase().trim(), reason: 'not found or inactive' },
          ipAddress: ip,
          superAdminId: admin?.id ?? (await getPlatformOwnerIdForAudit()),
        },
      })
      .catch(() => {})
    return { error: 'Invalid credentials' as const }
  }

  const valid = await bcrypt.compare(password, admin.passwordHash)
  if (!valid) {
    // L-5: log failed login attempt
    prisma.platformAuditLog
      .create({
        data: {
          action: 'LOGIN_FAILED',
          entity: 'SuperAdmin',
          entityId: admin.id,
          newValue: { reason: 'wrong password' },
          ipAddress: ip,
          superAdminId: admin.id,
        },
      })
      .catch(() => {})
    return { error: 'Invalid credentials' as const }
  }

  const token = await createSuperAdminToken({
    type: 'super_admin',
    superAdmin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions,
    },
    sessionToken: crypto.randomUUID(),
  })

  await Promise.all([
    prisma.superAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    }),
    // L-5: log successful super admin login
    prisma.platformAuditLog.create({
      data: {
        action: 'LOGIN',
        entity: 'SuperAdmin',
        entityId: admin.id,
        ipAddress: ip,
        superAdminId: admin.id,
      },
    }),
  ])

  const cookieStore = await cookies()
  const opts = setSessionCookie('super_admin', token)
  cookieStore.set(opts.name, opts.value, opts)

  return { success: true }
}

// Fallback for audit log when no admin is found: use the owner account
async function getPlatformOwnerIdForAudit(): Promise<string> {
  const owner = await prisma.superAdmin.findFirst({
    where: { role: 'OWNER', deletedAt: null },
    select: { id: true },
  })
  return owner?.id ?? 'unknown'
}

export async function superAdminLogout() {
  const cookieStore = await cookies()
  const c = clearSessionCookie('super_admin')
  cookieStore.set(c.name, c.value, c)
  redirect('/super-admin/login')
}

// ── Tenant Login ──────────────────────────────────────────────────────────
// L-4: tenantLogin server action removed — the login page calls /api/auth/login
// directly (rate-limited, deduped). This file now only contains the super admin
// path and logout helpers.

export async function tenantLogout() {
  const cookieStore = await cookies()
  const c = clearSessionCookie('tenant')
  cookieStore.set(c.name, c.value, c)
  redirect('/login')
}
