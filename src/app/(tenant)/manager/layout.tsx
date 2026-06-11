import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { UserProvider } from '@/context/user-context'
import { hexToHsl } from '@/lib/utils'
import { SubscriptionStatusBanner } from '@/components/billing/subscription-status-banner'
import { CancelledAccountNotice } from '@/components/billing/cancelled-account-notice'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      organizationId: session.organizationId,
      deletedAt: null,
      isActive: true,
    },
    include: { role: { select: { id: true, name: true, isSystem: true, permissions: true } } },
  })
  if (!user) redirect('/login')

  // Require dsr:approve or dsr:read_all
  const perms = user.role.permissions
  if (!perms.includes('*') && !perms.includes('dsr:approve') && !perms.includes('dsr:read_all')) {
    redirect('/admin')
  }

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

  const primaryHsl = hexToHsl(org.primaryColor)
  const secondaryHsl = hexToHsl(org.secondaryColor)
  const accentHsl = hexToHsl(org.accentColor)

  return (
    <UserProvider
      value={{
        userId: user.id,
        organizationId: user.organizationId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: { id: user.role.id, name: user.role.name, isSystem: user.role.isSystem },
        permissions: perms,
        preferences: (user.preferences as Record<string, unknown>) ?? {},
      }}
    >
      <style>{`:root { --primary: ${primaryHsl}; --secondary: ${secondaryHsl}; --accent: ${accentHsl}; }`}</style>
      <DashboardLayout
        variant="manager"
        orgName={org.name}
        userName={user.name}
        userEmail={user.email}
        userAvatar={user.avatar}
      >
        <SubscriptionStatusBanner org={org} />
        {org.status === 'CANCELLED' ? <CancelledAccountNotice /> : children}
      </DashboardLayout>
    </UserProvider>
  )
}
