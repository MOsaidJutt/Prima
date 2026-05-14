'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { PERMISSION_MODULES } from '@/lib/permissions'

export default function NewRolePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  function toggleSlug(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })
  }

  function toggleModule(slugs: string[]) {
    const allSelected = slugs.every((s) => selected.has(s))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) slugs.forEach((s) => next.delete(s))
      else slugs.forEach((s) => next.add(s))
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Role name is required.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          permissions: Array.from(selected),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Role created')
        router.push('/admin/settings/roles')
      } else {
        toast.error(data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/settings/roles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Role</h1>
          <p className="text-muted-foreground text-sm">
            Define a custom role with specific permissions
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Role Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Regional Manager"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What can this role do?"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <p className="text-muted-foreground text-sm">{selected.size} selected</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {PERMISSION_MODULES.map((mod) => {
              const allChecked = mod.slugs.every((s) => selected.has(s))
              const someChecked = mod.slugs.some((s) => selected.has(s)) && !allChecked
              return (
                <div key={mod.label}>
                  <div className="mb-2 flex items-center gap-2">
                    <Checkbox
                      id={`mod-${mod.label}`}
                      checked={allChecked}
                      onCheckedChange={() => toggleModule(mod.slugs)}
                      className={someChecked ? 'opacity-60' : ''}
                    />
                    <label
                      htmlFor={`mod-${mod.label}`}
                      className="cursor-pointer text-sm font-semibold"
                    >
                      {mod.label}
                    </label>
                  </div>
                  <div className="ml-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {mod.slugs.map((slug) => (
                      <div key={slug} className="flex items-center gap-2">
                        <Checkbox
                          id={slug}
                          checked={selected.has(slug)}
                          onCheckedChange={() => toggleSlug(slug)}
                        />
                        <label htmlFor={slug} className="cursor-pointer font-mono text-xs">
                          {slug.split(':')[1]}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Role
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link href="/admin/settings/roles">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
