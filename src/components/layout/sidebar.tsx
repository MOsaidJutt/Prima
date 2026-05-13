'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  ShieldCheck,
  BarChart3,
  ChevronLeft,
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

type NavItem = { label: string; href: string; icon: React.ElementType }

const superAdminNav: NavItem[] = [
  { label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { label: 'Organizations', href: '/super-admin/organizations', icon: Building2 },
  { label: 'Admins', href: '/super-admin/admins', icon: ShieldCheck },
  { label: 'Settings', href: '/super-admin/settings', icon: Settings },
]

const tenantAdminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

const managerNav: NavItem[] = [
  { label: 'Dashboard', href: '/manager', icon: LayoutDashboard },
  { label: 'Reports', href: '/manager/dsr/pending', icon: BarChart3 },
]

const salesRepNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My DSRs', href: '/dashboard/dsr', icon: BarChart3 },
]

type SidebarVariant = 'super_admin' | 'tenant_admin' | 'manager' | 'sales_rep'

const navMap: Record<SidebarVariant, NavItem[]> = {
  super_admin: superAdminNav,
  tenant_admin: tenantAdminNav,
  manager: managerNav,
  sales_rep: salesRepNav,
}

interface SidebarProps {
  variant: SidebarVariant
  orgName?: string
}

export function Sidebar({ variant, orgName }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const navItems = navMap[variant]

  return (
    <aside
      className={cn(
        'bg-card flex h-screen flex-col border-r transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">
              P
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Prima</p>
              {orgName && (
                <p className="text-muted-foreground max-w-[140px] truncate text-xs">{orgName}</p>
              )}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
