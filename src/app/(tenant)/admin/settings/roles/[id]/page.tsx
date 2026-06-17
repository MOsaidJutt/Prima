'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Lock } from 'lucide-react'
import Link from 'next/link'
import { PERMISSION_MODULES } from '@/lib/permissions'

type RoleDetail = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
  _count: { users: number }
}

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [role, setRole] = useState<RoleDetail | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/roles/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRole(data.data)
          setName(data.data.name)
          setDescription(data.data.description ?? '')
          setSelected(new Set(data.data.permissions))
        }
        setLoading(false)
      })
  }, [id])

  function toggleSlug(slug: string) {
    if (role?.isSystem) return
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })
  }

  function toggleModule(slugs: string[]) {
    if (role?.isSystem) return
    const allSelected = slugs.every((s) => selected.has(s))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) slugs.forEach((s) => next.delete(s))
      else slugs.forEach((s) => next.add(s))
      return next
    })
  }

  async function handleSave() {
    if (role?.isSystem) return
    setSaving(true)
    try {
      const res = await fetch(`/api/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          permissions: Array.from(selected),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Role updated')
        router.push('/admin/settings/roles')
      } else {
        toast.error(data.error)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  if (!role) return <p className="text-muted-foreground">Role not found.</p>

  const isReadOnly = role.isSystem

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to roles" asChild>
          <Link href="/admin/settings/roles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{role.name}</h1>
            {isReadOnly && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> System
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {isReadOnly ? 'System roles are read-only.' : `${role._count.users} user(s) assigned`}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Role Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isReadOnly} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                disabled={isReadOnly}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              {isReadOnly
                ? 'System role permissions are defined by the platform and cannot be changed.'
                : `${selected.size} selected`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {role.permissions.includes('*') ? (
              <p className="text-muted-foreground text-sm">
                This role has all permissions (wildcard).
              </p>
            ) : (
              PERMISSION_MODULES.map((mod) => {
                const allChecked = mod.slugs.every((s) => selected.has(s))
                return (
                  <div key={mod.label}>
                    <div className="mb-2 flex items-center gap-2">
                      <Checkbox
                        id={`mod-${mod.label}`}
                        checked={allChecked}
                        onCheckedChange={() => toggleModule(mod.slugs)}
                        disabled={isReadOnly}
                      />
                      <label
                        htmlFor={`mod-${mod.label}`}
                        className={`text-sm font-semibold ${isReadOnly ? '' : 'cursor-pointer'}`}
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
                            disabled={isReadOnly}
                          />
                          <label
                            htmlFor={slug}
                            className={`font-mono text-xs ${isReadOnly ? '' : 'cursor-pointer'}`}
                          >
                            {slug.split(':')[1]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {!isReadOnly && (
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/settings/roles">Cancel</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
