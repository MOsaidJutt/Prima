'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

export function SubmitDSRButton({ dsrId }: { dsrId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit() {
    if (!confirm('Submit this DSR for approval? You cannot edit it after submitting.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/dsr/${dsrId}/submit`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to submit DSR')
        return
      }
      toast.success('DSR submitted for approval')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleSubmit} disabled={loading}>
      <Send className="mr-2 h-4 w-4" />
      {loading ? 'Submitting…' : 'Submit for Approval'}
    </Button>
  )
}
