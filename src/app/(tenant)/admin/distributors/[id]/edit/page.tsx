'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DistributorForm, DistributorFormValues } from '@/components/distributor-form'
import type { UploadedFile } from '@/components/file-uploader'

export default function EditDistributorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [distributor, setDistributor] = useState<
    (DistributorFormValues & { code: string; attachments: UploadedFile[] }) | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/distributors/${id}`)
      .then((r) => r.json())
      .then((d) =>
        setDistributor({
          ...d,
          creditLimit: Number(d.creditLimit),
          attachments:
            d.attachments?.map(
              (a: {
                name: string
                fileUrl: string
                fileKey: string
                mimeType: string
                sizeBytes: number
              }) => ({
                name: a.name,
                fileUrl: a.fileUrl,
                fileKey: a.fileKey,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
              })
            ) ?? [],
        })
      )
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(data: DistributorFormValues, _attachments: UploadedFile[]) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/distributors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      toast.success('Distributor updated')
      router.push(`/admin/distributors/${id}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6">Loading…</div>
  if (!distributor) return <div className="p-6">Not found.</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link
          href={`/admin/distributors/${id}`}
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to Distributor
        </Link>
        <h1 className="text-2xl font-bold">Edit Distributor</h1>
        <p className="text-muted-foreground font-mono text-sm">{distributor.code}</p>
      </div>
      <DistributorForm
        defaultValues={distributor}
        defaultAttachments={distributor.attachments}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Save Changes"
      />
    </div>
  )
}
