'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import {
  createSuperAdminToken,
  createTenantToken,
  setSessionCookie,
  clearSessionCookie,
} from '@/lib/auth/session'

const BCRYPT_ROUNDS = 12

// ── Super Admin Login ──────────────────────────────────────────────────────

export async function superAdminLogin(email: string, password: string) {
  // C-2: filter deletedAt: null so soft-deleted admins cannot log in
  const admin = await prisma.superAdmin.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
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
  // L-3: use clearSessionCookie which includes full security flags
  const c = clearSessionCookie('super_admin')
  cookieStore.set(c.name, c.value, c)
  redirect('/super-admin/login')
}

// ── Tenant Login ──────────────────────────────────────────────────────────
// Phase 0: authenticates against adminPasswordHash stored on Organization.
// Phase 1c: replaced with User model auth.

export async function tenantLogin(email: string, password: string) {
  const org = await prisma.organization.findFirst({
    where: { adminEmail: email.toLowerCase().trim(), deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      plan: true,
      adminPasswordHash: true,
      onboardingCompleted: true,
    },
  })

  if (!org || !org.adminPasswordHash) {
    return { error: 'Invalid credentials' }
  }

  if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') {
    return { error: 'Your account has been suspended. Contact support.' }
  }

  const valid = await bcrypt.compare(password, org.adminPasswordHash)
  if (!valid) {
    return { error: 'Invalid credentials' }
  }

  const token = await createTenantToken({
    type: 'tenant',
    userId: org.id, // Phase 0: org id as placeholder; replaced by User.id in Phase 1c
    organizationId: org.id,
    organization: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      status: org.status,
      plan: org.plan,
    },
    sessionToken: crypto.randomUUID(),
  })

  const cookieStore = await cookies()
  const cookieOptions = setSessionCookie('tenant', token)
  cookieStore.set(cookieOptions.name, cookieOptions.value, cookieOptions)

  return { success: true, onboardingCompleted: org.onboardingCompleted }
}

export async function tenantLogout() {
  const cookieStore = await cookies()
  const c = clearSessionCookie('tenant')
  cookieStore.set(c.name, c.value, c)
  redirect('/login')
}
