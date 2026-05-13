import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Platform Settings' }

export default async function PlatformSettingsPage() {
  const settings = await prisma.platformSettings.findMany({ orderBy: { key: 'asc' } })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground">Global configuration for the Prima platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Settings</CardTitle>
          <CardDescription>
            Edit these values in the database or via the API. UI editor coming in Phase 6.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings.map((s) => (
              <div key={s.key} className="rounded-lg border p-4">
                <p className="text-primary font-mono text-sm font-medium">{s.key}</p>
                <pre className="text-muted-foreground mt-2 overflow-x-auto text-xs">
                  {JSON.stringify(s.value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
