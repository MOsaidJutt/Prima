import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

type DashboardLayoutProps = {
  children: React.ReactNode
  variant: 'super_admin' | 'tenant_admin' | 'manager' | 'sales_rep'
  orgName?: string
  userName?: string
  userEmail?: string
  userAvatar?: string | null
}

export function DashboardLayout({
  children,
  variant,
  orgName,
  userName,
  userEmail,
  userAvatar,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* WCAG 2.4.1: visible on keyboard focus, lets keyboard/screen-reader
          users jump past the sidebar and top bar */}
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <Sidebar variant={variant} orgName={orgName} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          variant={variant}
          userName={userName}
          userEmail={userEmail}
          userAvatar={userAvatar}
        />
        <main id="main-content" tabIndex={-1} className="bg-background flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
