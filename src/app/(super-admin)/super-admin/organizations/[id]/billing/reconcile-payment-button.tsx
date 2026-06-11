'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function ReconcilePaymentButton({ orgId, paymentId }: { orgId: string; paymentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'SUCCEEDED' | 'FAILED' | null>(null)

  async function reconcile(status: 'SUCCEEDED' | 'FAILED') {
    setLoading(status)
    try {
      const res = await fetch(
        `/api/super-admin/organizations/${orgId}/billing/payments/${paymentId}/reconcile`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to reconcile payment')
      toast.success(`Payment marked ${status === 'SUCCEEDED' ? 'paid' : 'failed'}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={loading !== null}
        onClick={() => reconcile('SUCCEEDED')}
      >
        {loading === 'SUCCEEDED' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark paid'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={loading !== null}
        onClick={() => reconcile('FAILED')}
      >
        {loading === 'FAILED' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark failed'}
      </Button>
    </div>
  )
}
