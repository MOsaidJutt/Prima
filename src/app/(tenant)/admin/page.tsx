import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LayoutDashboard } from 'lucide-react'

export const metadata = { title: 'Admin Dashboard' }

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Full dashboards and analytics coming in Phase 4</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          'Revenue',
          'Active Clients',
          'Pending DSRs',
          'Outstanding Invoices',
          'Team Members',
          'Products',
        ].map((label) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
              <LayoutDashboard className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-2xl font-bold">—</p>
              <p className="text-muted-foreground mt-1 text-xs">Available in Phase 4</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
