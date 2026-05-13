'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSuperAdminToken, setSessionCookie, clearSessionCookie } from '@/lib/auth/session'

// ── Super Admin Login ──────────────────────────────────────────────────────

export async function superAdminLogin(email: string, password: string) {
  const admin = await prisma.superAdmin.findUnique({
    where: { email: email.toLowerCase().trim() },
  })

  if (!admin || !admin.isActive) {
    return { error: 'Invalid credentials' }
  }

  const valid = await bcrypt.compare(password, admin.passwordHash)
  if (!valid) {
    return { error: 'Invalid credentials' }
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

  await prisma.superAdmin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  })

  const cookieStore = await cookies()
  const cookieOptions = setSessionCookie('super_admin', token)
  cookieStore.set(cookieOptions.name, cookieOptions.value, cookieOptions)

  return { success: true }
}

export async function superAdminLogout() {
  const cookieStore = await cookies()
  const c = clearSessionCookie('super_admin')
  cookieStore.set(c.name, c.value, { maxAge: 0, path: '/' })
  redirect('/super-admin/login')
}

// ── Tenant Login ──────────────────────────────────────────────────────────

export async function tenantLogin(_email: string, _password: string, _organizationSlug?: string) {
  // Phase 0: We store tenant users in the Phase 1 User model.
  // For now, we support the Tenant Admin whose credentials are set during onboarding.
  // We look up by email in the UserSession table's associated org.
  // This will be expanded in Phase 1 when the User model is added.

  // Placeholder: check against org adminEmail (set during invite acceptance)
  // Full implementation in Phase 1 with User model
  return { error: 'Tenant auth will be completed in Phase 1 when User model is added.' }
}

export async function tenantLogout() {
  const cookieStore = await cookies()
  const c = clearSessionCookie('tenant')
  cookieStore.set(c.name, c.value, { maxAge: 0, path: '/' })
  redirect('/login')
}
