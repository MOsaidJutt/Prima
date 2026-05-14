'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import Link from 'next/link'

type Role = { id: string; name: string; isSystem: boolean }
type Department = { id: string; name: string }

export default function InviteUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [form, setForm] = useState({
    email: '',
    name: '',
    roleId: '',
    departmentId: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/roles').then((r) => r.json()),
      fetch('/api/departments').then((r) => r.json()),
    ]).then(([rd, dd]) => {
      if (rd.success) setRoles(rd.data)
      if (dd.success) setDepartments(dd.data)
    })
  }, [])

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.roleId) {
      toast.error('Email and role are required.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name || undefined,
          roleId: form.roleId,
          departmentId: form.departmentId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send invitation')
        return
      }
      toast.success(`Invitation sent to ${form.email}`)
      router.push('/admin/users')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Invite User</h1>
          <p className="text-muted-foreground text-sm">
            Send an invitation email with a magic link
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="text-primary h-5 w-5" />
            New Invitation
          </CardTitle>
          <CardDescription>
            The user will receive an email to set their password and join your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full name (optional)</Label>
              <Input
                id="name"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Pre-fills their display name. They can change it.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.roleId} onValueChange={(v) => set('roleId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Department (optional)</Label>
              <Select value={form.departmentId} onValueChange={(v) => set('departmentId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
              <Button variant="outline" type="button" asChild>
                <Link href="/admin/users">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
