'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronLeft, Plus, Warehouse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

type Warehouse = {
  id: string
  code: string
  name: string
  city: string | null
  address: string | null
  isDefault: boolean
  isActive: boolean
  _count: { inventoryStock: number }
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', city: '', isDefault: false })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/warehouses')
      const data = await res.json()
      setWarehouses(data.warehouses ?? [])
    } catch {
      toast.error('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/v1/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error)
      }
      toast.success('Warehouse created')
      setForm({ name: '', address: '', city: '', isDefault: false })
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this warehouse?')) return
    const res = await fetch(`/api/v1/warehouses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deleted')
      load()
    } else {
      const e = await res.json()
      toast.error(e.error)
    }
  }

  async function handleSetDefault(id: string) {
    const res = await fetch(`/api/v1/warehouses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    })
    if (res.ok) {
      toast.success('Default warehouse updated')
      load()
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link
          href="/admin/inventory"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Inventory
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Warehouses</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Warehouse
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="h-20 animate-pulse" />
            </Card>
          ))
        ) : warehouses.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center text-sm">
              No warehouses yet.
            </CardContent>
          </Card>
        ) : (
          warehouses.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex items-center gap-4 pt-4">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Warehouse className="text-primary h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{w.name}</p>
                    <span className="text-muted-foreground font-mono text-xs">{w.code}</span>
                    {w.isDefault && (
                      <Badge variant="default" className="text-xs">
                        Default
                      </Badge>
                    )}
                    {!w.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {(w.city || w.address) && (
                    <p className="text-muted-foreground text-sm">
                      {[w.address, w.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {w._count.inventoryStock} product variants
                  </p>
                </div>
                <div className="flex gap-2">
                  {!w.isDefault && (
                    <Button variant="outline" size="sm" onClick={() => handleSetDefault(w.id)}>
                      Set Default
                    </Button>
                  )}
                  {!w.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(w.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Warehouse</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="def"
                checked={form.isDefault}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v }))}
              />
              <Label htmlFor="def">Set as default warehouse</Label>
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
