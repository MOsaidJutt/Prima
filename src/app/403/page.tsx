import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Access denied — Prima' }

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div>
        <p className="text-muted-foreground font-mono text-sm">403</p>
        <h2 className="mt-2 text-2xl font-semibold">Access denied</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          You don&apos;t have permission to view this page. If you think this is a mistake, ask your
          organization admin to review your role.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  )
}
