'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from 'date-fns'

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  scope: z.enum(['ORGANIZATION', 'DEPARTMENT', 'USER', 'PRODUCT', 'CLIENT']),
  type: z.enum(['REVENUE', 'UNITS', 'VISITS', 'NEW_CLIENTS', 'COLLECTIONS']),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']),
  userId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  targetValue: z.number().positive('Target value must be positive'),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

interface Props {
  users: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  products: { id: string; name: string; sku: string }[]
  clients: { id: string; companyName: string; code: string }[]
  defaultValues?: Partial<FormValues & { id: string }>
}

export function TargetForm({ users, departments, products, clients, defaultValues }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const now = new Date()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      scope: 'ORGANIZATION',
      type: 'REVENUE',
      period: 'MONTHLY',
      periodStart: format(startOfMonth(now), 'yyyy-MM-dd'),
      periodEnd: format(endOfMonth(now), 'yyyy-MM-dd'),
    },
  })

  const scope = watch('scope')
  const period = watch('period')

  function handlePeriodChange(p: string) {
    setValue('period', p as FormValues['period'])
    if (p === 'MONTHLY') {
      setValue('periodStart', format(startOfMonth(now), 'yyyy-MM-dd'))
      setValue('periodEnd', format(endOfMonth(now), 'yyyy-MM-dd'))
    } else if (p === 'QUARTERLY') {
      setValue('periodStart', format(startOfQuarter(now), 'yyyy-MM-dd'))
      setValue('periodEnd', format(endOfQuarter(now), 'yyyy-MM-dd'))
    } else if (p === 'YEARLY') {
      setValue('periodStart', format(startOfYear(now), 'yyyy-MM-dd'))
      setValue('periodEnd', format(endOfYear(now), 'yyyy-MM-dd'))
    }
  }

  async function onSubmit(data: FormValues) {
    setSaving(true)
    const url = defaultValues?.id ? `/api/v1/targets/${defaultValues.id}` : '/api/v1/targets'
    const method = defaultValues?.id ? 'PUT' : 'POST'
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          periodStart: new Date(data.periodStart).toISOString(),
          periodEnd: new Date(data.periodEnd).toISOString(),
          userId: data.scope === 'USER' ? data.userId : undefined,
          departmentId: data.scope === 'DEPARTMENT' ? data.departmentId : undefined,
          productId: data.scope === 'PRODUCT' ? data.productId : undefined,
          clientId: data.scope === 'CLIENT' ? data.clientId : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to save target')
        return
      }
      toast.success(defaultValues?.id ? 'Target updated' : 'Target created')
      router.push('/admin/targets')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Target Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>
              Target Name <span className="text-destructive">*</span>
            </Label>
            <Input {...register('name')} placeholder="e.g. Monthly Revenue Target Q1" />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Scope</Label>
            <select
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              {...register('scope')}
            >
              <option value="ORGANIZATION">Organization</option>
              <option value="DEPARTMENT">Department</option>
              <option value="USER">User</option>
              <option value="PRODUCT">Product</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Metric Type</Label>
            <select
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              {...register('type')}
            >
              <option value="REVENUE">Revenue (PKR)</option>
              <option value="UNITS">Units Sold</option>
              <option value="VISITS">Client Visits</option>
              <option value="NEW_CLIENTS">New Clients</option>
              <option value="COLLECTIONS">Collections (PKR)</option>
            </select>
          </div>

          {scope === 'USER' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>User</Label>
              <select
                className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                {...register('userId')}
              >
                <option value="">Select user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {scope === 'DEPARTMENT' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Department</Label>
              <select
                className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                {...register('departmentId')}
              >
                <option value="">Select department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {scope === 'PRODUCT' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Product</Label>
              <select
                className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                {...register('productId')}
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
          )}
          {scope === 'CLIENT' && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Client</Label>
              <select
                className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                {...register('clientId')}
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Target Value</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              {...register('targetValue', { valueAsNumber: true })}
            />
            {errors.targetValue && (
              <p className="text-destructive text-xs">{errors.targetValue.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Period</Label>
            <select
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" {...register('periodStart')} />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input type="date" {...register('periodEnd')} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : defaultValues?.id ? 'Save Changes' : 'Create Target'}
      </Button>
    </form>
  )
}
