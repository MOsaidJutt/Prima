import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, FolderOpen, Palette, Building, ClipboardList } from 'lucide-react'

// InvoiceTemplate link removed — route does not exist until Phase 3.
const SETTINGS_SECTIONS = [
  {
    href: '/admin/settings/roles',
    icon: Shield,
    title: 'Roles & Permissions',
    description: 'Manage system and custom roles with granular permission control',
  },
  {
    href: '/admin/settings/departments',
    icon: FolderOpen,
    title: 'Departments',
    description: 'Organize your team into departments with optional hierarchy',
  },
  {
    href: '/admin/settings/branding',
    icon: Palette,
    title: 'Branding',
    description: 'Customize logo, colors, fonts and email templates',
  },
  {
    href: '/admin/settings/organization',
    icon: Building,
    title: 'Organization',
    description: 'Company details, tax info, locale and billing contact',
  },
  {
    href: '/admin/settings/audit-log',
    icon: ClipboardList,
    title: 'Audit Log',
    description: 'Full history of all mutations with old/new value diffs',
  },
]

export default function SettingsIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your workspace configuration</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="hover:border-primary/50 h-full cursor-pointer transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <CardDescription className="mt-0.5 text-xs">{s.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
