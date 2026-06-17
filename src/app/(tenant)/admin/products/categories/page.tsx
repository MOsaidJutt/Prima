'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Category = {
  id: string
  name: string
  description: string | null
  _count: { products: number }
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/products/categories')
      const data = await res.json()
      setCategories(data.categories ?? [])
    } catch {
      toast.error('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/v1/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      toast.success('Category created')
      setName('')
      setDescription('')
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link
          href="/admin/products"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Products
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Product Categories</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Category
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-b py-3">
                <div className="bg-muted h-5 w-40 animate-pulse rounded" />
              </div>
            ))
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No categories yet.</p>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between border-b py-3 last:border-b-0"
              >
                <div>
                  <p className="font-medium">{cat.name}</p>
                  {cat.description && (
                    <p className="text-muted-foreground text-sm">{cat.description}</p>
                  )}
                  <p className="text-muted-foreground text-xs">{cat._count.products} products</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Beverages"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
