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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().min(1, 'Template name required'),
  isDefault: z.boolean().default(false),
  headerHtml: z.string().optional(),
  footerHtml: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  taxLabel: z.string().default('GST'),
  invoiceNumberPrefix: z.string().default('INV'),
  invoiceNumberPadding: z.number().int().min(1).max(8).default(4),
  invoiceNumberIncludeYear: z.boolean().default(true),
  bankDetailsEnabled: z.boolean().default(false),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIban: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface TemplateEditorProps {
  mode: 'create' | 'edit'
  defaultValues?: Partial<FormValues & { id: string; bankDetails?: Record<string, string> | null }>
}

export function InvoiceTemplateEditor({ mode, defaultValues }: TemplateEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues
      ? {
          name: defaultValues.name ?? '',
          isDefault: defaultValues.isDefault ?? false,
          headerHtml: defaultValues.headerHtml ?? '',
          footerHtml: defaultValues.footerHtml ?? '',
          logoUrl: defaultValues.logoUrl ?? '',
          primaryColor: defaultValues.primaryColor ?? '#0F172A',
          accentColor: defaultValues.accentColor ?? '#0369A1',
          taxLabel: defaultValues.taxLabel ?? 'GST',
          invoiceNumberPrefix: defaultValues.invoiceNumberPrefix ?? 'INV',
          invoiceNumberPadding: defaultValues.invoiceNumberPadding ?? 4,
          invoiceNumberIncludeYear: defaultValues.invoiceNumberIncludeYear ?? true,
          bankDetailsEnabled: defaultValues.bankDetailsEnabled ?? false,
          bankName: (defaultValues.bankDetails as Record<string, string> | null)?.bankName ?? '',
          bankAccount:
            (defaultValues.bankDetails as Record<string, string> | null)?.bankAccount ?? '',
          bankIban: (defaultValues.bankDetails as Record<string, string> | null)?.bankIban ?? '',
        }
      : {
          primaryColor: '#0F172A',
          accentColor: '#0369A1',
          taxLabel: 'GST',
          invoiceNumberPrefix: 'INV',
          invoiceNumberPadding: 4,
          invoiceNumberIncludeYear: true,
          bankDetailsEnabled: false,
        },
  })

  const isDefault = watch('isDefault')
  const bankEnabled = watch('bankDetailsEnabled')
  const includeYear = watch('invoiceNumberIncludeYear')
  const prefix = watch('invoiceNumberPrefix') || 'INV'
  const padding = watch('invoiceNumberPadding') || 4
  const primaryColor = watch('primaryColor')

  const previewNumber = includeYear
    ? `${prefix}-${new Date().getFullYear()}-${'0'.repeat(padding - 1)}1`
    : `${prefix}-${'0'.repeat(padding - 1)}1`

  async function onSubmit(data: FormValues) {
    setSaving(true)
    const url =
      mode === 'edit'
        ? `/api/v1/invoice-templates/${defaultValues?.id}`
        : '/api/v1/invoice-templates'
    const method = mode === 'edit' ? 'PUT' : 'POST'
    try {
      const payload = {
        ...data,
        bankDetails: data.bankDetailsEnabled
          ? { bankName: data.bankName, bankAccount: data.bankAccount, bankIban: data.bankIban }
          : null,
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to save template')
        return
      }
      toast.success(mode === 'create' ? 'Template created' : 'Template updated')
      router.push('/admin/settings/invoice-templates')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input {...register('name')} placeholder="e.g. Standard, Export, Local" />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={(v) => setValue('isDefault', v)}
              />
              <Label htmlFor="isDefault">Set as default template</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Numbering</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Prefix</Label>
                <Input {...register('invoiceNumberPrefix')} placeholder="INV" />
              </div>
              <div className="space-y-2">
                <Label>Padding</Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  {...register('invoiceNumberPadding', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax Label</Label>
                <Input {...register('taxLabel')} placeholder="GST / VAT" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="includeYear"
                checked={includeYear}
                onCheckedChange={(v) => setValue('invoiceNumberIncludeYear', v)}
              />
              <Label htmlFor="includeYear">Include year in number</Label>
            </div>
            <div className="bg-muted/40 rounded-md px-4 py-3 text-sm">
              <span className="text-muted-foreground">Preview: </span>
              <span className="font-mono font-bold">{previewNumber}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Colors</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="h-10 w-14 p-1"
                  value={primaryColor || '#0F172A'}
                  onChange={(e) => setValue('primaryColor', e.target.value)}
                />
                <Input {...register('primaryColor')} className="font-mono" placeholder="#0F172A" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="h-10 w-14 p-1"
                  value={watch('accentColor') || '#0369A1'}
                  onChange={(e) => setValue('accentColor', e.target.value)}
                />
                <Input {...register('accentColor')} className="font-mono" placeholder="#0369A1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Header & Footer HTML</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Header HTML (optional)</Label>
              <Textarea
                rows={3}
                placeholder="<div>Custom header HTML…</div>"
                {...register('headerHtml')}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Footer HTML (optional)</Label>
              <Textarea
                rows={3}
                placeholder="<div>Terms, signature…</div>"
                {...register('footerHtml')}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo URL (optional)</Label>
              <Input {...register('logoUrl')} placeholder="https://…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bank Details</CardTitle>
            <Switch
              checked={bankEnabled}
              onCheckedChange={(v) => setValue('bankDetailsEnabled', v)}
            />
          </CardHeader>
          {bankEnabled && (
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input {...register('bankName')} />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input {...register('bankAccount')} />
              </div>
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input {...register('bankIban')} />
              </div>
            </CardContent>
          )}
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create Template' : 'Save Changes'}
        </Button>
      </form>

      {/* Live Preview */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Preview</h3>
        <div
          className="rounded-lg border bg-white p-8 text-sm shadow-sm"
          style={{ fontFamily: 'sans-serif' }}
        >
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="text-xl font-bold" style={{ color: primaryColor || '#0F172A' }}>
                Your Company
              </div>
              <div className="text-xs text-gray-500">123 Business St, Karachi</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">INVOICE</div>
              <div className="font-mono text-sm text-gray-500">{previewNumber}</div>
            </div>
          </div>
          <div className="mb-4 border-t pt-4">
            <div className="mb-1 text-xs text-gray-400">BILL TO</div>
            <div className="font-bold">Sample Client Ltd</div>
            <div className="text-xs text-gray-500">client@example.com</div>
          </div>
          <table className="mb-4 w-full text-xs">
            <thead>
              <tr
                className="border-b"
                style={{ backgroundColor: primaryColor || '#0F172A' + '10' }}
              >
                <th className="px-2 py-2 text-left text-gray-600">Description</th>
                <th className="px-2 py-2 text-right text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-2 py-2">Sample product</td>
                <td className="px-2 py-2 text-right font-mono">PKR 1,000</td>
              </tr>
            </tbody>
          </table>
          <div className="space-y-1 text-right text-xs">
            <div className="text-gray-500">Subtotal: PKR 1,000</div>
            <div className="text-gray-500">{watch('taxLabel') || 'GST'} (17%): PKR 170</div>
            <div className="text-base font-bold" style={{ color: primaryColor || '#0F172A' }}>
              Total: PKR 1,170
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
