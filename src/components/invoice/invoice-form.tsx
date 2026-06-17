'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlusCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'

const lineSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, 'Description required'),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discountType: z.enum(['PERCENT', 'FLAT']).optional(),
  discountValue: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).default(0),
})

const schema = z.object({
  clientId: z.string().uuid('Select a client'),
  templateId: z.string().uuid().optional(),
  issueDate: z.string().min(1),
  dueDate: z.string().optional(),
  shippingAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lineItems: z.array(lineSchema).min(1, 'Add at least one line item'),
})

type FormValues = z.infer<typeof schema>

interface Client {
  id: string
  companyName: string
  code: string
  paymentTerms: number
}
interface Product {
  id: string
  name: string
  sku: string
  sellingPrice: { toString(): string }
  taxRate: { toString(): string }
  unitOfMeasure: string
}
interface Template {
  id: string
  name: string
  isDefault: boolean
}

interface InvoiceFormProps {
  clients: Client[]
  products: Product[]
  templates: Template[]
  prefillDSR?: {
    clientId: string
    lineItems: Array<{
      productId: string
      quantity: number
      unitPrice: { toString(): string }
      taxRate: { toString(): string }
      product: { name: string }
    }>
  } | null
}

export function InvoiceForm({ clients, products, templates, prefillDSR }: InvoiceFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]))
  const defaultTemplate = templates.find((t) => t.isDefault)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: prefillDSR?.clientId ?? '',
      templateId: defaultTemplate?.id,
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      shippingAmount: 0,
      lineItems: prefillDSR
        ? prefillDSR.lineItems.map((li) => ({
            productId: li.productId,
            description: li.product.name,
            quantity: li.quantity,
            unitPrice: Number(li.unitPrice),
            taxRate: Number(li.taxRate),
          }))
        : [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const watchedLines = watch('lineItems')
  const watchedClientId = watch('clientId')
  const shipping = watch('shippingAmount') || 0

  function calcLine(idx: number) {
    const li = watchedLines[idx]
    if (!li) return { base: 0, discount: 0, tax: 0, total: 0 }
    const base = (li.quantity || 0) * (li.unitPrice || 0)
    let discount = 0
    if (li.discountType === 'PERCENT' && li.discountValue)
      discount = (base * li.discountValue) / 100
    else if (li.discountType === 'FLAT' && li.discountValue) discount = li.discountValue
    const tax = ((base - discount) * (li.taxRate || 0)) / 100
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
  const grandWithShipping = totals.grand + Number(shipping)

  // Auto-set due date when client changes
  function handleClientChange(clientId: string) {
    const client = clientMap[clientId]
    if (client) {
      setValue('dueDate', format(addDays(new Date(), client.paymentTerms), 'yyyy-MM-dd'))
    }
  }

  async function onSubmit(data: FormValues, issue: boolean) {
    setSaving(true)
    try {
      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          issueDate: new Date(data.issueDate).toISOString(),
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
          issue,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to create invoice')
        return
      }
      toast.success(issue ? 'Invoice issued' : 'Invoice draft saved')
      router.push(`/admin/invoices/${json.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Client <span className="text-destructive">*</span>
            </Label>
            <select
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              {...register('clientId', { onChange: (e) => handleClientChange(e.target.value) })}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.code})
                </option>
              ))}
            </select>
            {errors.clientId && (
              <p className="text-destructive text-xs">{errors.clientId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <select
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              {...register('templateId')}
            >
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Issue Date</Label>
            <Input type="date" {...register('issueDate')} />
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input type="date" {...register('dueDate')} />
          </div>
          <div className="space-y-2">
            <Label>Shipping (PKR)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              {...register('shippingAmount', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} placeholder="Any notes for the client…" {...register('notes')} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Terms & Conditions</Label>
            <Textarea rows={2} placeholder="Payment terms, return policy…" {...register('terms')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 0 })}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.lineItems && (
            <p className="text-destructive text-xs">
              {typeof errors.lineItems.message === 'string'
                ? errors.lineItems.message
                : 'Invalid line items'}
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
                    <Label className="text-xs">Product (optional)</Label>
                    <select
                      className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                      {...register(`lineItems.${idx}.productId`, {
                        onChange: (e) => {
                          const p = productMap[e.target.value]
                          if (p) {
                            setValue(`lineItems.${idx}.description`, p.name)
                            setValue(`lineItems.${idx}.unitPrice`, Number(p.sellingPrice))
                            setValue(`lineItems.${idx}.taxRate`, Number(p.taxRate))
                          }
                        },
                      })}
                    >
                      <option value="">Custom item…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Description <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...register(`lineItems.${idx}.description`)}
                      placeholder="Item description"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
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
                    <div className="space-y-1">
                      <Label className="text-xs">Tax %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        {...register(`lineItems.${idx}.taxRate`, { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                  <div className="flex items-end justify-end">
                    <div className="text-right">
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
              {Number(shipping) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-mono">PKR {Number(shipping).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Grand Total</span>
                <span className="font-mono">PKR {grandWithShipping.toLocaleString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleSubmit((d) => onSubmit(d, false))}
          disabled={saving}
        >
          Save as Draft
        </Button>
        <Button type="button" onClick={handleSubmit((d) => onSubmit(d, true))} disabled={saving}>
          {saving ? 'Saving…' : 'Issue Invoice'}
        </Button>
      </div>
    </div>
  )
}
