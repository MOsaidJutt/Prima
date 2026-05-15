import { redirect } from 'next/navigation'
import { getTenantSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { UserProvider } from '@/context/user-context'
import { hexToHsl } from '@/lib/utils'

export default async function SalesRepLayout({ children }: { children: React.ReactNode }) {
  const session = await getTenantSession()
  if (!session) redirect('/login')

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
    },
  })
  if (!org) redirect('/login')

  const primaryHsl = hexToHsl(org.primaryColor)
  const secondaryHsl = hexToHsl(org.secondaryColor)
  const accentHsl = hexToHsl(org.accentColor)
  const isCustomFont = org.fontFamily !== 'Plus Jakarta Sans'

  return (
    <UserProvider
      value={{
        userId: user.id,
        organizationId: user.organizationId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: { id: user.role.id, name: user.role.name, isSystem: user.role.isSystem },
        permissions: user.role.permissions,
        preferences: (user.preferences as Record<string, unknown>) ?? {},
      }}
    >
      <style>{`:root { --primary: ${primaryHsl}; --secondary: ${secondaryHsl}; --accent: ${accentHsl}; } ${isCustomFont ? `body { font-family: '${org.fontFamily}', sans-serif; }` : ''}`}</style>
      {isCustomFont && (
        <style>{`@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(org.fontFamily)}:wght@300;400;500;600;700&display=swap');`}</style>
      )}
      <DashboardLayout
        variant="sales_rep"
        orgName={org.name}
        userName={user.name}
        userEmail={user.email}
        userAvatar={user.avatar}
      >
        {children}
      </DashboardLayout>
    </UserProvider>
  )
}
