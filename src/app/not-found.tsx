import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div>
        <p className="text-muted-foreground font-mono text-sm">404</p>
        <h2 className="mt-2 text-2xl font-semibold">Page not found</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  )
}
