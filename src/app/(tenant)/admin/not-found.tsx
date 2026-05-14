import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div>
        <p className="text-muted-foreground font-mono text-sm">404</p>
        <h2 className="mt-2 text-xl font-semibold">Not found</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          This record does not exist or you do not have access to it.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/admin">Back to Dashboard</Link>
      </Button>
    </div>
  )
}
