'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const schema = z.object({
  companyName: z.string().min(1, 'Required'),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('PK'),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  distributorId: z.string().optional(),
  assignedRepId: z.string().optional(),
  businessType: z
    .enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'MANUFACTURER', 'SERVICE', 'OTHER'])
    .optional(),
  businessSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  industry: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT', 'CHURNED']).default('ACTIVE'),
  creditLimit: z.coerce.number().min(0).default(0),
  paymentTerms: z.coerce.number().min(0).default(30),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewClientPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [distributors, setDistributors] = useState<{ id: string; companyName: string }[]>([])
  const [reps, setReps] = useState<{ id: string; name: string }[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { country: 'PK', status: 'ACTIVE', creditLimit: 0, paymentTerms: 30 },
  })

  useEffect(() => {
    fetch('/api/v1/distributors?pageSize=100')
      .then((r) => r.json())
      .then((d) => setDistributors(d.distributors ?? []))
    // /api/users (not /api/v1/users) returns { data: User[] }
    fetch('/api/users?pageSize=100')
      .then((r) => r.json())
      .then((d) =>
        setReps(
          (d.data ?? []).filter((u: { role: { name: string } }) =>
            ['Sales Rep', 'Manager'].includes(u.role?.name)
          )
        )
      )
  }, [])

  async function onSubmit(data: FormValues) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      const client = await res.json()
      toast.success(`Client ${client.code} created`)
      router.push(`/admin/clients/${client.id}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  function Field({
    name,
    label,
    required,
    type = 'text',
  }: {
    name: keyof FormValues
    label: string
    required?: boolean
    type?: string
  }) {
    return (
      <div className="space-y-1">
        <Label>
          {label}
          {required && ' *'}
        </Label>
        <Input type={type} {...register(name as never)} />
        {errors[name] && (
          <p className="text-destructive text-xs">{errors[name]?.message as string}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link
          href="/admin/clients"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to Clients
        </Link>
        <h1 className="text-2xl font-bold">New Client</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="companyName" label="Company Name" required />
            <Field name="contactName" label="Primary Contact" />
            <Field name="email" label="Email" type="email" />
            <Field name="phone" label="Phone" />
            <Field name="phone2" label="Phone 2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Address</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field name="address" label="Street Address" />
            </div>
            <Field name="city" label="City" />
            <Field name="state" label="State" />
            <Field name="ntn" label="NTN" />
            <Field name="strn" label="STRN" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Distributor (Optional)</Label>
              <Select onValueChange={(v) => setValue('distributorId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select distributor…" />
                </SelectTrigger>
                <SelectContent>
                  {distributors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Assigned Sales Rep</Label>
              <Select onValueChange={(v) => setValue('assignedRepId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rep…" />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Business Type</Label>
              <Select
                onValueChange={(v) => setValue('businessType', v as FormValues['businessType'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  {['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'MANUFACTURER', 'SERVICE', 'OTHER'].map(
                    (t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Business Size</Label>
              <Select
                onValueChange={(v) => setValue('businessSize', v as FormValues['businessSize'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size…" />
                </SelectTrigger>
                <SelectContent>
                  {['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(v) => setValue('status', v as FormValues['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="PROSPECT">Prospect</SelectItem>
                  <SelectItem value="CHURNED">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field name="industry" label="Industry" />
            <Field name="creditLimit" label="Credit Limit (PKR)" type="number" />
            <Field name="paymentTerms" label="Payment Terms (days)" type="number" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea {...register('notes')} placeholder="Internal notes…" rows={3} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Client'}
          </Button>
        </div>
      </form>
    </div>
  )
}
