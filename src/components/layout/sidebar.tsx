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
  Shield,
  FolderOpen,
  UserCircle,
  Palette,
  ClipboardList,
  Building,
  Truck,
  Package,
  Warehouse,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { usePermission } from '@/context/user-context'

type NavItem = { label: string; href: string; icon: React.ElementType; slug?: string }

const superAdminNav: NavItem[] = [
  { label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { label: 'Organizations', href: '/super-admin/organizations', icon: Building2 },
  { label: 'Admins', href: '/super-admin/admins', icon: ShieldCheck },
  { label: 'Settings', href: '/super-admin/settings', icon: Settings },
]

const tenantAdminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  // Phase 2 — Business Entities
  { label: 'Distributors', href: '/admin/distributors', icon: Truck, slug: 'distributors:read' },
  { label: 'Clients', href: '/admin/clients', icon: Users, slug: 'clients:read' },
  { label: 'Products', href: '/admin/products', icon: Package, slug: 'products:read' },
  { label: 'Inventory', href: '/admin/inventory', icon: Warehouse, slug: 'inventory:read' },
  // Phase 1 — Team
  { label: 'Users', href: '/admin/users', icon: Users, slug: 'users:read' },
  { label: 'Roles', href: '/admin/settings/roles', icon: Shield, slug: 'roles:read' },
  {
    label: 'Departments',
    href: '/admin/settings/departments',
    icon: FolderOpen,
    slug: 'departments:read',
  },
  { label: 'Branding', href: '/admin/settings/branding', icon: Palette, slug: 'branding:update' },
  {
    label: 'Organization',
    href: '/admin/settings/organization',
    icon: Building,
    slug: 'organization:read',
  },
  {
    label: 'Audit Log',
    href: '/admin/settings/audit-log',
    icon: ClipboardList,
    slug: 'audit_log:read',
  },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

const managerNav: NavItem[] = [
  { label: 'Dashboard', href: '/manager', icon: LayoutDashboard },
  { label: 'Pending DSRs', href: '/manager/dsr/pending', icon: BarChart3 },
]

const salesRepNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My DSRs', href: '/dashboard/dsr', icon: BarChart3 },
]

type SidebarVariant = 'super_admin' | 'tenant_admin' | 'manager' | 'sales_rep'

interface SidebarProps {
  variant: SidebarVariant
  orgName?: string
}

function TenantNavItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname()
  const active = pathname === item.href || pathname.startsWith(item.href + '/')
  // Always call the hook unconditionally — use 'organization:read' as a safe fallback
  // when item.slug is undefined (the result is ignored in that case).
  const slugToCheck = (item.slug as Parameters<typeof usePermission>[0]) ?? 'organization:read'
  const permissionGranted = usePermission(slugToCheck)
  const isVisible = !item.slug || permissionGranted

  if (!isVisible) return null

  return (
    <Link
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
}

export function Sidebar({ variant, orgName }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const staticNavItems =
    variant === 'super_admin'
      ? superAdminNav
      : variant === 'manager'
        ? managerNav
        : variant === 'sales_rep'
          ? salesRepNav
          : null

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
        {variant === 'tenant_admin'
          ? tenantAdminNav.map((item) => (
              <TenantNavItem key={item.href} item={item} collapsed={collapsed} />
            ))
          : staticNavItems?.map((item) => {
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

      {/* Profile shortcut (tenant only) */}
      {variant === 'tenant_admin' && !collapsed && (
        <div className="border-t p-2">
          <Link
            href="/admin/profile"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <UserCircle className="h-4 w-4 shrink-0" />
            <span>Profile</span>
          </Link>
        </div>
      )}
    </aside>
  )
}
