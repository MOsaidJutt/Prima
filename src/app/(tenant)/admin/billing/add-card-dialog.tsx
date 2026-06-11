'use client'

import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripeConfigured = !!publishableKey && !publishableKey.includes('xxxx')
const stripePromise = stripeConfigured ? loadStripe(publishableKey) : null

interface AddCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}

export function AddCardDialog({ open, onOpenChange, onAdded }: AddCardDialogProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !stripeConfigured) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setClientSecret(null)
    fetch('/api/v1/billing/payment-methods/setup-intent', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.clientSecret) setClientSecret(d.clientSecret)
        else toast.error(d.error ?? 'Could not start card setup')
      })
      .catch(() => toast.error('Could not start card setup'))
      .finally(() => setLoading(false))
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Add a card to use for subscription renewals and AI token top-ups.
          </DialogDescription>
        </DialogHeader>

        {!stripeConfigured ? (
          <p className="text-muted-foreground text-sm">
            Card payments are not configured for this environment. Contact your administrator to
            enable Stripe.
          </p>
        ) : loading || !clientSecret ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <AddCardForm
              onSuccess={() => {
                onOpenChange(false)
                onAdded()
              }}
              onCancel={() => onOpenChange(false)}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [makeDefault, setMakeDefault] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!stripe || !elements) return
    setSubmitting(true)
    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      })
      if (error) {
        toast.error(error.message ?? 'Could not save card')
        return
      }

      const paymentMethodId =
        typeof setupIntent?.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent?.payment_method?.id

      if (!paymentMethodId) {
        toast.error('Could not save card')
        return
      }

      const res = await fetch('/api/v1/billing/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId, makeDefault }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not save card')

      toast.success('Card added')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save card')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      <div className="flex items-center gap-2">
        <Checkbox
          id="makeDefault"
          checked={makeDefault}
          onCheckedChange={(v) => setMakeDefault(v === true)}
        />
        <Label htmlFor="makeDefault" className="font-normal">
          Set as default payment method
        </Label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!stripe || submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Card
        </Button>
      </DialogFooter>
    </div>
  )
}
