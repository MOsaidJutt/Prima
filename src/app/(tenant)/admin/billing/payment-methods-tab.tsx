'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CreditCard, Plus, Star, Trash2 } from 'lucide-react'
import { BillingErrorState } from '@/components/billing/billing-error-state'
import { AddCardDialog } from './add-card-dialog'
import type { PaymentMethodDTO } from './page'

const BRAND_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
}

export function PaymentMethodsTab({ onChanged }: { onChanged: () => void }) {
  const router = useRouter()
  const [methods, setMethods] = useState<PaymentMethodDTO[] | null>(null)
  const [methodsError, setMethodsError] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  // Fetch-only loader for the mount effect; load() (event handlers only)
  // also resets state so no setState runs synchronously inside the effect.
  const fetchMethods = useCallback(() => {
    fetch('/api/v1/billing/payment-methods')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load payment methods')
        return r.json()
      })
      .then((d) => setMethods(d.paymentMethods ?? []))
      .catch(() => setMethodsError(true))
  }, [])

  const load = useCallback(() => {
    setMethodsError(false)
    setMethods(null)
    fetchMethods()
  }, [fetchMethods])

  useEffect(() => {
    fetchMethods()
  }, [fetchMethods])

  async function setDefault(id: string) {
    setActionId(id)
    try {
      const res = await fetch(`/api/v1/billing/payment-methods/${id}`, { method: 'PATCH' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not set default payment method')
      toast.success('Default payment method updated')
      load()
      onChanged()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setActionId(null)
    }
  }

  async function remove(id: string) {
    setActionId(id)
    try {
      const res = await fetch(`/api/v1/billing/payment-methods/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not remove payment method')
      toast.success('Payment method removed')
      load()
      onChanged()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saved Payment Methods</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add card
        </Button>
      </div>

      {methodsError ? (
        <BillingErrorState message="Could not load payment methods." onRetry={load} />
      ) : !methods ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : methods.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            No payment methods saved yet. Add a card to enable subscription renewals and
            auto-top-ups.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center justify-between pt-6">
                <div className="flex items-center gap-3">
                  <div className="bg-muted rounded-lg p-2">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {BRAND_LABEL[m.brand?.toLowerCase() ?? ''] ?? m.brand ?? m.provider} ••••{' '}
                      {m.last4}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {m.expMonth && m.expYear ? `Expires ${m.expMonth}/${m.expYear}` : m.provider}
                    </p>
                  </div>
                  {m.isDefault && <Badge variant="success">Default</Badge>}
                </div>
                <div className="flex gap-2">
                  {!m.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionId === m.id}
                      onClick={() => setDefault(m.id)}
                    >
                      {actionId === m.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Star className="mr-1.5 h-3.5 w-3.5" />
                          Make default
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actionId === m.id}
                    onClick={() => remove(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddCardDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => {
          load()
          onChanged()
          router.refresh()
        }}
      />
    </div>
  )
}
