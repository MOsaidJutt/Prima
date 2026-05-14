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
import { ImageUploader } from '@/components/file-uploader'
import { Badge } from '@/components/ui/badge'

const schema = z.object({
  sku: z.string().min(1, 'Required'),
  barcode: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  unitOfMeasure: z.string().default('pcs'),
  packSize: z.coerce.number().int().min(1).default(1),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).default('ACTIVE'),
})
type FormValues = z.infer<typeof schema>

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [stockInfo, setStockInfo] = useState<
    Array<{ quantity: number; warehouse: { name: string } }>
  >([])

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
      fetch(`/api/v1/products/${id}`).then((r) => r.json()),
      fetch('/api/v1/products/categories').then((r) => r.json()),
    ])
      .then(([product, cats]) => {
        reset({
          ...product,
          costPrice: Number(product.costPrice),
          sellingPrice: Number(product.sellingPrice),
          mrp: product.mrp ? Number(product.mrp) : undefined,
          taxRate: Number(product.taxRate),
          categoryId: product.category?.id ?? '',
        })
        setImages(product.images ?? [])
        setCategories(cats.categories ?? [])
        setStockInfo(product.inventoryStock ?? [])
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [id, reset])

  async function onSubmit(data: FormValues) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, images }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      toast.success('Product updated')
      router.push('/admin/products')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6">Loading…</div>

  const totalStock = stockInfo.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link
          href="/admin/products"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Products
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Edit Product</h1>
          <Badge variant="outline">Total Stock: {totalStock}</Badge>
        </div>
      </div>

      {stockInfo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current Stock Levels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {stockInfo.map((s, i) => (
                <div key={i} className="text-center">
                  <p className="text-muted-foreground text-xs">{s.warehouse.name}</p>
                  <p className="text-lg font-bold">{s.quantity}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['sku', 'SKU', true],
              ['barcode', 'Barcode'],
            ].map(([n, l, req]) => (
              <div key={String(n)} className="space-y-1">
                <Label>
                  {String(l)}
                  {req && ' *'}
                </Label>
                <Input {...register(n as keyof FormValues)} />
              </div>
            ))}
            <div className="space-y-1 sm:col-span-2">
              <Label>Product Name *</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Textarea {...register('description')} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={watch('categoryId') ?? ''}
                onValueChange={(v) => setValue('categoryId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
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
            <div className="space-y-1">
              <Label>Brand</Label>
              <Input {...register('brand')} />
            </div>
            <div className="space-y-1">
              <Label>Unit of Measure</Label>
              <Input {...register('unitOfMeasure')} />
            </div>
            <div className="space-y-1">
              <Label>Pack Size</Label>
              <Input type="number" {...register('packSize')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pricing & Inventory</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Cost Price (PKR)</Label>
              <Input type="number" step="0.01" {...register('costPrice')} />
            </div>
            <div className="space-y-1">
              <Label>Selling Price (PKR)</Label>
              <Input type="number" step="0.01" {...register('sellingPrice')} />
            </div>
            <div className="space-y-1">
              <Label>MRP (PKR)</Label>
              <Input type="number" step="0.01" {...register('mrp')} />
            </div>
            <div className="space-y-1">
              <Label>Tax Rate (%)</Label>
              <Input type="number" step="0.01" {...register('taxRate')} />
            </div>
            <div className="space-y-1">
              <Label>Reorder Level</Label>
              <Input type="number" {...register('reorderLevel')} />
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
                  <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Images</CardTitle>
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
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
