import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Something went wrong — Prima' }

// Runtime errors are handled by error.tsx / global-error.tsx boundaries.
// This static page exists for direct navigation and for infrastructure-level
// custom error routing (load balancer / CDN 5xx pages).
export default function ServerErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div>
        <p className="text-muted-foreground font-mono text-sm">500</p>
        <h2 className="mt-2 text-2xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          An unexpected error occurred on our side. Our team has been notified — please try again in
          a few minutes.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  )
}
