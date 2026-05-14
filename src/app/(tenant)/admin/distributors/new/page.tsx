'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DistributorForm, DistributorFormValues } from '@/components/distributor-form'
import type { UploadedFile } from '@/components/file-uploader'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function NewDistributorPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(data: DistributorFormValues, attachments: UploadedFile[]) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/distributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create distributor')
      }
      const distributor = await res.json()

      // Save attachments if any
      if (attachments.length) {
        await Promise.all(
          attachments.map((att) =>
            fetch('/api/v1/distributors/attachments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ distributorId: distributor.id, ...att }),
            })
          )
        )
      }

      toast.success(`Distributor ${distributor.code} created`)
      router.push(`/admin/distributors/${distributor.id}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link
          href="/admin/distributors"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to Distributors
        </Link>
        <h1 className="text-2xl font-bold">New Distributor</h1>
        <p className="text-muted-foreground text-sm">
          A code will be auto-generated (e.g. DST-0001)
        </p>
      </div>
      <DistributorForm
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Create Distributor"
      />
    </div>
  )
}
