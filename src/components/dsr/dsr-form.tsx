'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlusCircle, Trash2, MapPin, Star } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

const lineSchema = z.object({
  productId: z.string().uuid('Select a product'),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discountType: z.enum(['PERCENT', 'FLAT']).optional(),
  discountValue: z.number().min(0).optional(),
})

const schema = z.object({
  clientId: z.string().uuid('Select a client'),
  reportDate: z.string().min(1, 'Select a date'),
  visitType: z.enum(['IN_PERSON', 'PHONE', 'VIRTUAL', 'EMAIL']),
  visitNotes: z.string().optional(),
  outcome: z.string().optional(),
  followUpDate: z.string().optional(),
  satisfaction: z.number().int().min(1).max(5).optional(),
  lineItems: z.array(lineSchema).min(0),
})

type FormValues = z.infer<typeof schema>

interface Client {
  id: string
  companyName: string
  code: string
  city: string | null
  lastOrderDate: Date | null
}
interface Product {
  id: string
  name: string
  sku: string
  sellingPrice: { toString(): string }
  taxRate: { toString(): string }
  unitOfMeasure: string
}

interface DSRFormProps {
  clients: Client[]
  products: Product[]
  mode: 'create' | 'edit'
  defaultValues?: {
    id: string
    clientId: string
    reportDate: Date
    visitType: string
    visitNotes: string | null
    outcome: string | null
    followUpDate: Date | null
    satisfaction: number | null
    lineItems: Array<{
      productId: string
      quantity: number
      unitPrice: { toString(): string }
      discountType: string | null
      discountValue: { toString(): string } | null
    }>
  }
}

export function DSRForm({ clients, products, mode, defaultValues }: DSRFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(null)
  const [starHover, setStarHover] = useState(0)

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues
      ? {
          clientId: defaultValues.clientId,
          reportDate: format(defaultValues.reportDate, 'yyyy-MM-dd'),
          visitType: defaultValues.visitType as 'IN_PERSON' | 'PHONE' | 'VIRTUAL' | 'EMAIL',
          visitNotes: defaultValues.visitNotes ?? '',
          outcome: defaultValues.outcome ?? '',
          followUpDate: defaultValues.followUpDate
            ? format(defaultValues.followUpDate, 'yyyy-MM-dd')
            : '',
          satisfaction: defaultValues.satisfaction ?? undefined,
          lineItems: defaultValues.lineItems.map((li) => ({
            productId: li.productId,
            quantity: li.quantity,
            unitPrice: Number(li.unitPrice),
            discountType: (li.discountType as 'PERCENT' | 'FLAT') ?? undefined,
            discountValue: li.discountValue ? Number(li.discountValue) : undefined,
          })),
        }
      : {
          reportDate: format(new Date(), 'yyyy-MM-dd'),
          visitType: 'IN_PERSON',
          lineItems: [],
        },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const watchedLines = watch('lineItems')
  const satisfaction = watch('satisfaction')

  function calcLine(idx: number) {
    const li = watchedLines[idx]
    if (!li) return { base: 0, discount: 0, tax: 0, total: 0 }
    const base = (li.quantity || 0) * (li.unitPrice || 0)
    let discount = 0
    if (li.discountType === 'PERCENT' && li.discountValue)
      discount = (base * li.discountValue) / 100
    else if (li.discountType === 'FLAT' && li.discountValue) discount = li.discountValue
    const product = productMap[li.productId]
    const taxRate = product ? Number(product.taxRate) : 0
    const tax = ((base - discount) * taxRate) / 100
    return { base, discount, tax, total: base - discount + tax }
  }

  const totals = watchedLines.reduce(
    (acc, _, i) => {
      const c = calcLine(i)
      return {
        subtotal: acc.subtotal + c.base - c.discount,
        tax: acc.tax + c.tax,
        grand: acc.grand + c.total,
      }
    },
    { subtotal: 0, tax: 0, grand: 0 }
  )

  function getGeo() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        toast.success('Location captured')
      },
      () => toast.error('Could not get location')
    )
  }

  const onSubmit = useCallback(
    async (data: FormValues, saveDraft: boolean) => {
      setSaving(true)
      const url = mode === 'edit' ? `/api/v1/dsr/${defaultValues!.id}` : '/api/v1/dsr'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      try {
        const body = {
          ...data,
          reportDate: new Date(data.reportDate).toISOString(),
          followUpDate: data.followUpDate ? new Date(data.followUpDate).toISOString() : null,
          latitude: geo?.lat ?? null,
          longitude: geo?.lon ?? null,
          saveDraft,
        }
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Failed to save DSR')
          return
        }
        toast.success(saveDraft ? 'Draft saved' : 'DSR submitted for approval')
        router.push(saveDraft ? `/dashboard/dsr/${json.id}` : '/dashboard/dsr')
        router.refresh()
      } finally {
        setSaving(false)
      }
    },
    [mode, defaultValues, geo, router]
  )

  return (
    <div className="max-w-3xl space-y-6">
      {/* Visit Info */}
      <Card>
        <CardHeader>
          <CardTitle>Visit Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Client <span className="text-destructive">*</span>
            </Label>
            <select
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              {...register('clientId')}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.code}) {c.city ? `— ${c.city}` : ''}
                </option>
              ))}
            </select>
            {errors.clientId && (
              <p className="text-destructive text-xs">{errors.clientId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Report Date <span className="text-destructive">*</span>
            </Label>
            <Input type="date" {...register('reportDate')} />
            {errors.reportDate && (
              <p className="text-destructive text-xs">{errors.reportDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Visit Type</Label>
            <select
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              {...register('visitType')}
            >
              <option value="IN_PERSON">In Person</option>
              <option value="PHONE">Phone</option>
              <option value="VIRTUAL">Virtual</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Follow-up Date</Label>
            <Input type="date" {...register('followUpDate')} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Visit Notes</Label>
            <Textarea
              placeholder="What was discussed during this visit?"
              rows={3}
              {...register('visitNotes')}
            />
          </div>

          <div className="space-y-2">
            <Label>Outcome</Label>
            <Input placeholder="e.g. Order placed, Follow-up required" {...register('outcome')} />
          </div>

          <div className="space-y-2">
            <Label>Customer Satisfaction</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setStarHover(n)}
                  onMouseLeave={() => setStarHover(0)}
                  onClick={() => setValue('satisfaction', n)}
                >
                  <Star
                    className={`h-6 w-6 transition-colors ${n <= (starHover || satisfaction || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                  />
                </button>
              ))}
              {satisfaction && (
                <span className="text-muted-foreground ml-2 text-sm">{satisfaction}/5</span>
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={getGeo}>
              <MapPin className="mr-2 h-4 w-4" />
              {geo ? `Location: ${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}` : 'Capture Location'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Products</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ productId: '', quantity: 1, unitPrice: 0 })}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No products added yet. Click &quot;Add Product&quot; to begin.
            </p>
          )}
          {fields.map((field, idx) => {
            const calc = calcLine(idx)
            return (
              <div key={field.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Item {idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove item"
                    onClick={() => remove(idx)}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Product</Label>
                    <select
                      className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                      {...register(`lineItems.${idx}.productId`, {
                        onChange: (e) => {
                          const p = productMap[e.target.value]
                          if (p) setValue(`lineItems.${idx}.unitPrice`, Number(p.sellingPrice))
                        },
                      })}
                    >
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        {...register(`lineItems.${idx}.quantity`, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`lineItems.${idx}.unitPrice`, { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Discount Type</Label>
                      <select
                        className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                        {...register(`lineItems.${idx}.discountType`)}
                      >
                        <option value="">None</option>
                        <option value="PERCENT">Percent (%)</option>
                        <option value="FLAT">Flat (PKR)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discount Value</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`lineItems.${idx}.discountValue`, { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <div className="w-full text-right">
                      <p className="text-muted-foreground text-xs">
                        Tax: PKR {calc.tax.toLocaleString()}
                      </p>
                      <p className="font-medium">PKR {calc.total.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {fields.length > 0 && (
            <div className="bg-muted/40 space-y-1 rounded-lg p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">PKR {totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-mono">PKR {totals.tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>Grand Total</span>
                <span className="font-mono">PKR {totals.grand.toLocaleString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleSubmit((d) => onSubmit(d, true))}
          disabled={saving}
        >
          Save as Draft
        </Button>
        <Button type="button" onClick={handleSubmit((d) => onSubmit(d, false))} disabled={saving}>
          {saving ? 'Saving…' : 'Submit for Approval'}
        </Button>
      </div>
    </div>
  )
}
