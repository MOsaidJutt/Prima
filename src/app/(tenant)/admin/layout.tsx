import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { UserProvider } from '@/context/user-context'
import { hexToHsl } from '@/lib/utils'
import { ChatFloat } from '@/components/ai/chat-float'
import { SubscriptionStatusBanner } from '@/components/billing/subscription-status-banner'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  // Fetch full user + role + org branding in one query
  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      organizationId: session.organizationId,
      deletedAt: null,
      isActive: true,
    },
    include: {
      role: { select: { id: true, name: true, isSystem: true, permissions: true } },
      department: true,
    },
  })

  // If no User found (e.g. legacy Phase 0 session where userId === orgId),
  // clear the cookie by redirecting to login. Re-login creates a proper session.
  if (!user) redirect('/login')

  const org = await prisma.organization.findFirst({
    where: { id: session.organizationId, deletedAt: null },
    select: {
      name: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      fontFamily: true,
      logoLight: true,
      status: true,
      trialEndsAt: true,
      pastDueAt: true,
      gracePeriodEndsAt: true,
    },
  })

  if (!org) redirect('/login')

  // Phase 6: a CANCELLED org may only access /admin/billing — redirect
  // everything else there so tenants can reactivate their subscription.
  if (org.status === 'CANCELLED') {
    const pathname = (await headers()).get('x-pathname') ?? ''
    if (!pathname.startsWith('/admin/billing')) redirect('/admin/billing')
  }

  // Convert hex branding colors to HSL for CSS variable injection
  const primaryHsl = hexToHsl(org.primaryColor)
  const secondaryHsl = hexToHsl(org.secondaryColor)
  const accentHsl = hexToHsl(org.accentColor)
  const isCustomFont = org.fontFamily !== 'Plus Jakarta Sans'

  const preferences = (user.preferences as Record<string, unknown>) ?? {}

  return (
    <UserProvider
      value={{
        userId: user.id,
        organizationId: user.organizationId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: {
          id: user.role.id,
          name: user.role.name,
          isSystem: user.role.isSystem,
        },
        permissions: user.role.permissions,
        preferences,
      }}
    >
      {/* Dynamic branding CSS override — scoped to :root to override globals.css defaults */}
      <style>{`
        :root {
          --primary: ${primaryHsl};
          --secondary: ${secondaryHsl};
          --accent: ${accentHsl};
        }
        ${isCustomFont ? `body { font-family: '${org.fontFamily}', sans-serif; }` : ''}
      `}</style>

      {/* Google Font import for custom fonts */}
      {isCustomFont && (
        <style>{`@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(org.fontFamily)}:wght@300;400;500;600;700&display=swap');`}</style>
      )}

      <DashboardLayout
        variant="tenant_admin"
        orgName={org.name}
        userName={user.name}
        userEmail={user.email}
        userAvatar={user.avatar}
      >
        <SubscriptionStatusBanner org={org} />
        {children}
        <ChatFloat />
      </DashboardLayout>
    </UserProvider>
  )
}
