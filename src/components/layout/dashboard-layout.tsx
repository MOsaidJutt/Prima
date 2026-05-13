import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

type DashboardLayoutProps = {
  children: React.ReactNode
  variant: 'super_admin' | 'tenant_admin' | 'manager' | 'sales_rep'
  orgName?: string
  userName?: string
  userEmail?: string
}

export function DashboardLayout({
  children,
  variant,
  orgName,
  userName,
  userEmail,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar variant={variant} orgName={orgName} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar variant={variant} userName={userName} userEmail={userEmail} />
        <main className="bg-background flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
