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

// ── Super Admin Login ──────────────────────────────────────────────────────

export async function superAdminLogin(email: string, password: string) {
  const admin = await prisma.superAdmin.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
  })

  if (!admin || !admin.isActive) return { error: 'Invalid credentials' }

  const valid = await bcrypt.compare(password, admin.passwordHash)
  if (!valid) return { error: 'Invalid credentials' }

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
  const opts = setSessionCookie('super_admin', token)
  cookieStore.set(opts.name, opts.value, opts)

  return { success: true }
}

export async function superAdminLogout() {
  const cookieStore = await cookies()
  const c = clearSessionCookie('super_admin')
  cookieStore.set(c.name, c.value, c)
  redirect('/super-admin/login')
}

// ── Tenant Login ──────────────────────────────────────────────────────────
// Phase 1c: authenticates against User.passwordHash (not Organization.adminPasswordHash).
// Falls back to adminPasswordHash for orgs that completed onboarding before Phase 1c
// (i.e., before User records were created). The fallback path will be removed in Phase 7.

export async function tenantLogin(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim()

  // Look up User record first (Phase 1c path)
  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      deletedAt: null,
      isActive: true,
      organization: { deletedAt: null },
    },
    include: {
      organization: {
        select: { id: true, slug: true, name: true, status: true, plan: true, deletedAt: true },
      },
      role: { select: { id: true, name: true, isSystem: true, permissions: true } },
    },
  })

  if (user && user.passwordHash) {
    const org = user.organization
    if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') {
      return { error: 'Your account has been suspended. Contact support.' }
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return { error: 'Invalid credentials' }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const token = await createTenantToken({
      type: 'tenant',
      userId: user.id,
      organizationId: org.id,
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        status: org.status,
        plan: org.plan,
      },
      role: { id: user.role.id, name: user.role.name, isSystem: user.role.isSystem },
      permissions: user.role.permissions,
      sessionToken: crypto.randomUUID(),
    })

    const cookieStore = await cookies()
    const opts = setSessionCookie('tenant', token)
    cookieStore.set(opts.name, opts.value, opts)

    // Fetch onboarding state from org
    const orgFull = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { onboardingCompleted: true },
    })
    return { success: true, onboardingCompleted: orgFull?.onboardingCompleted ?? true }
  }

  // Phase 0 fallback: org admin who hasn't had a User created yet
  const org = await prisma.organization.findFirst({
    where: { adminEmail: normalizedEmail, deletedAt: null },
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

  if (!org || !org.adminPasswordHash) return { error: 'Invalid credentials' }

  if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') {
    return { error: 'Your account has been suspended. Contact support.' }
  }

  const valid = await bcrypt.compare(password, org.adminPasswordHash)
  if (!valid) return { error: 'Invalid credentials' }

  // Legacy JWT — userId === org.id (Phase 0 placeholder). Any API call that
  // does a DB User lookup will return null → 401. This forces re-login after
  // the User record is created (e.g. after running the seed migration).
  const token = await createTenantToken({
    type: 'tenant',
    userId: org.id,
    organizationId: org.id,
    organization: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      status: org.status,
      plan: org.plan,
    },
    role: { id: '', name: 'Owner', isSystem: true },
    permissions: ['*'],
    sessionToken: crypto.randomUUID(),
  })

  const cookieStore = await cookies()
  const opts = setSessionCookie('tenant', token)
  cookieStore.set(opts.name, opts.value, opts)

  return { success: true, onboardingCompleted: org.onboardingCompleted }
}

export async function tenantLogout() {
  const cookieStore = await cookies()
  const c = clearSessionCookie('tenant')
  cookieStore.set(c.name, c.value, c)
  redirect('/login')
}
