'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Next.js App Router error boundary for the /admin/* route segment.
// Catches unhandled React errors in client components (e.g. failed fetches,
// render exceptions) and shows a graceful recovery UI instead of a blank screen.

export default function AdminError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Forward to Sentry when integrated (Phase 7)
    console.error('[admin-error-boundary]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
        <AlertTriangle className="text-destructive h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          An unexpected error occurred. If this keeps happening, contact your administrator.
        </p>
        {error.digest && (
          <p className="text-muted-foreground font-mono text-xs">Error ID: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  )
}
