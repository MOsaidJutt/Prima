import { redirect } from 'next/navigation'
import { getSuperAdminSession } from '@/lib/auth/session'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSuperAdminSession()
  if (!session) redirect('/super-admin/login')

  return (
    <DashboardLayout
      variant="super_admin"
      orgName="Platform Admin"
      userName={session.superAdmin.name}
      userEmail={session.superAdmin.email}
    >
      {children}
    </DashboardLayout>
  )
}
