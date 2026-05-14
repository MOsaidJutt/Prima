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
import { ImageUploader } from '@/components/file-uploader'

const schema = z.object({
  sku: z.string().optional(),
  barcode: z.string().optional(),
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  unitOfMeasure: z.string().default('pcs'),
  packSize: z.coerce.number().int().min(1).default(1),
  costPrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  mrp: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).default('ACTIVE'),
})

type FormValues = z.infer<typeof schema>

export default function NewProductPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      unitOfMeasure: 'pcs',
      packSize: 1,
      taxRate: 0,
      reorderLevel: 0,
      status: 'ACTIVE',
    },
  })

  useEffect(() => {
    fetch('/api/v1/products/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
  }, [])

  async function onSubmit(data: FormValues) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, images }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      const product = await res.json()
      toast.success(`Product ${product.sku} created`)
      router.push('/admin/products')
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
          href="/admin/products"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Products
        </Link>
        <h1 className="text-2xl font-bold">New Product</h1>
        <p className="text-muted-foreground text-sm">SKU will be auto-generated if left blank</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="sku" label="SKU (leave blank to auto-generate)" />
            <Field name="barcode" label="Barcode" />
            <div className="sm:col-span-2">
              <Field name="name" label="Product Name" required />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Textarea {...register('description')} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select onValueChange={(v) => setValue('categoryId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field name="brand" label="Brand" />
            <Field name="unitOfMeasure" label="Unit of Measure" />
            <Field name="packSize" label="Pack Size" type="number" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pricing</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="costPrice" label="Cost Price (PKR)" type="number" />
            <Field name="sellingPrice" label="Selling Price (PKR)" type="number" />
            <Field name="mrp" label="MRP (PKR)" type="number" />
            <Field name="taxRate" label="Tax Rate (%)" type="number" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="reorderLevel" label="Reorder Level (units)" type="number" />
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
                  <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Images</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUploader
              value={images}
              onChange={setImages}
              uploadEndpoint="/api/v1/products/upload-url"
              maxImages={5}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  )
}
