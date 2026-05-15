'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

const schema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentDate: z.string().min(1),
  method: z.enum(['CASH', 'BANK', 'CHEQUE', 'CARD', 'WALLET', 'OTHER']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  sendReceipt: z.boolean().default(false),
})

type FormValues = z.infer<typeof schema>

interface RecordPaymentModalProps {
  invoiceId: string
  balance: number
  invoiceNumber: string
}

export function RecordPaymentModal({ invoiceId, balance, invoiceNumber }: RecordPaymentModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: balance,
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      method: 'BANK',
      sendReceipt: false,
    },
  })

  const sendReceipt = watch('sendReceipt')

  async function onSubmit(data: FormValues) {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          paymentDate: new Date(data.paymentDate).toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to record payment')
        return
      }
      toast.success(`Payment of PKR ${data.amount.toLocaleString()} recorded`)
      setOpen(false)
      reset()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <DollarSign className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {invoiceNumber}</DialogTitle>
        </DialogHeader>
        <div className="text-muted-foreground mb-4 text-sm">
          Outstanding balance:{' '}
          <span className="text-foreground font-mono font-bold">
            PKR {balance.toLocaleString()}
          </span>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>
                Amount (PKR) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min={0.01}
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" {...register('paymentDate')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <select
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              {...register('method')}
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Card</option>
              <option value="WALLET">Digital Wallet</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Reference Number</Label>
            <Input placeholder="Transaction ID, cheque number…" {...register('referenceNumber')} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea rows={2} placeholder="Any additional notes…" {...register('notes')} />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="sendReceipt"
              checked={sendReceipt}
              onCheckedChange={(v) => setValue('sendReceipt', v)}
            />
            <Label htmlFor="sendReceipt">Send receipt email to client</Label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Recording…' : 'Record Payment'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
