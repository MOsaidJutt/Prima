'use client'

import { use, useEffect, useState } from 'react'
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
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
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

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [distributors, setDistributors] = useState<{ id: string; companyName: string }[]>([])
  const [reps, setReps] = useState<{ id: string; name: string }[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/clients/${id}`).then((r) => r.json()),
      fetch('/api/v1/distributors?pageSize=100').then((r) => r.json()),
      fetch('/api/users?pageSize=100').then((r) => r.json()),
    ])
      .then(([client, dists, users]) => {
        reset({
          ...client,
          creditLimit: Number(client.creditLimit),
          paymentTerms: client.paymentTerms,
          distributorId: client.distributor?.id ?? '',
          assignedRepId: client.assignedRep?.id ?? '',
        })
        setDistributors(dists.distributors ?? [])
        setReps(
          (users.data ?? []).filter((u: { role: { name: string } }) =>
            ['Sales Rep', 'Manager'].includes(u.role?.name)
          )
        )
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [id, reset])

  async function onSubmit(data: FormValues) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      toast.success('Client updated')
      router.push(`/admin/clients/${id}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6">Loading…</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link
          href={`/admin/clients/${id}`}
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold">Edit Client</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['companyName', 'Company Name', true],
              ['contactName', 'Contact'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['address', 'Address'],
              ['city', 'City'],
              ['state', 'State'],
            ].map(([n, l, req]) => (
              <div
                key={String(n)}
                className={n === 'address' ? 'space-y-1 sm:col-span-2' : 'space-y-1'}
              >
                <Label>
                  {String(l)}
                  {req && ' *'}
                </Label>
                <Input {...register(n as keyof FormValues)} />
                {errors[n as keyof FormValues] && (
                  <p className="text-destructive text-xs">
                    {errors[n as keyof FormValues]?.message as string}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  {['ACTIVE', 'INACTIVE', 'PROSPECT', 'CHURNED'].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Distributor</Label>
              <Select
                value={watch('distributorId') ?? ''}
                onValueChange={(v) => setValue('distributorId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
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
              <Label>Sales Rep</Label>
              <Select
                value={watch('assignedRepId') ?? ''}
                onValueChange={(v) => setValue('assignedRepId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
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
              <Label>Credit Limit (PKR)</Label>
              <Input type="number" {...register('creditLimit')} />
            </div>
            <div className="space-y-1">
              <Label>Payment Terms (days)</Label>
              <Input type="number" {...register('paymentTerms')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea {...register('notes')} rows={3} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
