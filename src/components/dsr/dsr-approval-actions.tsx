'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export function DSRApprovalActions({ dsrId }: { dsrId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [createInvoice, setCreateInvoice] = useState(true)

  async function approve() {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/dsr/${dsrId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createInvoice }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Approval failed')
        return
      }
      toast.success(createInvoice ? 'DSR approved & invoice draft created' : 'DSR approved')
      router.push('/manager/dsr/pending')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function reject() {
    if (!reason.trim()) {
      toast.error('Please enter a rejection reason')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/dsr/${dsrId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Rejection failed')
        return
      }
      toast.success('DSR rejected')
      router.push('/manager/dsr/pending')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch id="createInvoice" checked={createInvoice} onCheckedChange={setCreateInvoice} />
          <Label htmlFor="createInvoice">Auto-create invoice draft on approval</Label>
        </div>

        {!rejecting ? (
          <div className="flex gap-3">
            <Button
              onClick={approve}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {loading ? 'Approving…' : 'Approve DSR'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRejecting(true)}
              disabled={loading}
              className="text-destructive border-destructive hover:bg-destructive/10"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>
                Rejection Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Explain why this DSR is being rejected…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="destructive" onClick={reject} disabled={loading}>
                {loading ? 'Rejecting…' : 'Confirm Rejection'}
              </Button>
              <Button variant="outline" onClick={() => setRejecting(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
