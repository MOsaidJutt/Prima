'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { OrgStatus } from '@prisma/client'

export function OrgStatusActions({
  orgId,
  currentStatus,
}: {
  orgId: string
  currentStatus: OrgStatus
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function updateStatus(status: OrgStatus) {
    setLoading(status)
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`Organization ${status.toLowerCase()}`)
      router.refresh()
    } catch {
      toast.error('Action failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-2">
      {currentStatus !== 'ACTIVE' && (
        <Button size="sm" onClick={() => updateStatus('ACTIVE')} disabled={!!loading}>
          {loading === 'ACTIVE' ? '…' : 'Activate'}
        </Button>
      )}
      {currentStatus === 'ACTIVE' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateStatus('SUSPENDED')}
          disabled={!!loading}
        >
          {loading === 'SUSPENDED' ? '…' : 'Suspend'}
        </Button>
      )}
      <Button
        size="sm"
        variant="destructive"
        onClick={() => updateStatus('CANCELLED')}
        disabled={!!loading}
      >
        {loading === 'CANCELLED' ? '…' : 'Cancel'}
      </Button>
    </div>
  )
}
