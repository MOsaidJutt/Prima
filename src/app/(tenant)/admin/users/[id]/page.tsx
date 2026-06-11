'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PermissionGate } from '@/components/permission-gate'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Loader2, Mail, Key, Ban } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

type UserDetail = {
  id: string
  name: string
  email: string
  phone: string | null
  avatar: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  role: { id: string; name: string; isSystem: boolean }
  department: { id: string; name: string } | null
  aiTokenQuota: number | null
  aiQuotaUsed: number
  aiQuotaResetAt: string
  org: {
    aiEnabled: boolean
    perUserQuotasEnabled: boolean
    defaultUserQuota: number
  }
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    name: '',
    phone: '',
    roleId: '',
    departmentId: '',
    aiTokenQuota: '',
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/users/${id}`).then((r) => r.json()),
      fetch('/api/roles').then((r) => r.json()),
      fetch('/api/departments').then((r) => r.json()),
    ]).then(([ud, rd, dd]) => {
      if (ud.success) {
        setUser(ud.data)
        setForm({
          name: ud.data.name,
          phone: ud.data.phone ?? '',
          roleId: ud.data.role.id,
          departmentId: ud.data.department?.id ?? '',
          aiTokenQuota: ud.data.aiTokenQuota?.toString() ?? '',
        })
      }
      if (rd.success) setRoles(rd.data)
      if (dd.success) setDepartments(dd.data)
      setLoading(false)
    })
  }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          roleId: form.roleId,
          departmentId: form.departmentId || null,
          aiTokenQuota: form.aiTokenQuota.trim() === '' ? null : Number(form.aiTokenQuota),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('User updated')
        setUser((u) => (u ? { ...u, aiTokenQuota: data.data.aiTokenQuota } : u))
      } else {
        toast.error(data.error)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSuspend() {
    const res = await fetch(`/api/users/${id}/suspend`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      toast.success(data.isActive ? 'User activated' : 'User suspended')
      setUser((u) => (u ? { ...u, isActive: data.isActive } : u))
    } else {
      toast.error(data.error)
    }
  }

  async function handleResetPassword() {
    const res = await fetch(`/api/users/${id}/reset-password`, { method: 'POST' })
    const data = await res.json()
    if (data.success) toast.success('Password reset email sent')
    else toast.error(data.error)
  }

  async function handleDelete() {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      toast.success('User deleted')
      router.push('/admin/users')
    } else {
      toast.error(data.error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <p className="text-muted-foreground">User not found.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={user.isActive ? 'default' : 'destructive'}>
            {user.isActive ? 'Active' : 'Suspended'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: avatar + quick info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-20 w-20">
                {user.avatar && <AvatarImage src={user.avatar} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-semibold">{user.name}</p>
                <Badge variant="outline" className="mt-1">
                  {user.role.name}
                </Badge>
              </div>
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last login</span>
                  <span>
                    {user.lastLoginAt
                      ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Joined</span>
                  <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
                {user.department && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department</span>
                    <span>{user.department.name}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="edit">
            <TabsList>
              <TabsTrigger value="edit">Details</TabsTrigger>
              {user.org.aiEnabled && user.org.perUserQuotasEnabled && (
                <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
              )}
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>User Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+92..."
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={form.roleId}
                        onValueChange={(v) => setForm({ ...form, roleId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
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
                      <Label>Department</Label>
                      <Select
                        value={form.departmentId || '__none__'}
                        onValueChange={(v) =>
                          setForm({ ...form, departmentId: v === '__none__' ? '' : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No department</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <PermissionGate slug="users:update">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </PermissionGate>
                </CardContent>
              </Card>
            </TabsContent>

            {user.org.aiEnabled && user.org.perUserQuotasEnabled && (
              <TabsContent value="ai-usage" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Token Usage</CardTitle>
                    <CardDescription>
                      Monthly AI token consumption for this user. Resets on{' '}
                      {new Date(user.aiQuotaResetAt).toLocaleDateString()}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(() => {
                      const effectiveQuota = user.aiTokenQuota ?? user.org.defaultUserQuota
                      const usagePct =
                        effectiveQuota > 0
                          ? Math.min(100, Math.round((user.aiQuotaUsed / effectiveQuota) * 100))
                          : 0
                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tokens used this month</span>
                            <span className="font-medium">
                              {user.aiQuotaUsed.toLocaleString()} /{' '}
                              {effectiveQuota.toLocaleString()}
                            </span>
                          </div>
                          <Progress value={usagePct} className="h-2" />
                        </div>
                      )
                    })()}

                    <PermissionGate
                      slug="users:update"
                      fallback={
                        <div className="space-y-2">
                          <Label>Monthly Quota</Label>
                          <p className="text-sm">
                            {user.aiTokenQuota
                              ? `${user.aiTokenQuota.toLocaleString()} tokens (custom)`
                              : `${user.org.defaultUserQuota.toLocaleString()} tokens (organization default)`}
                          </p>
                        </div>
                      }
                    >
                      <div className="space-y-2">
                        <Label>Custom Monthly Quota (tokens)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={form.aiTokenQuota}
                          onChange={(e) => setForm({ ...form, aiTokenQuota: e.target.value })}
                          placeholder={`Default: ${user.org.defaultUserQuota.toLocaleString()}`}
                        />
                        <p className="text-muted-foreground text-xs">
                          Leave blank to use the organization default of{' '}
                          {user.org.defaultUserQuota.toLocaleString()} tokens/month.
                        </p>
                      </div>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Quota
                      </Button>
                    </PermissionGate>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="actions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Account Actions</CardTitle>
                  <CardDescription>These actions affect the user immediately.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <PermissionGate slug="users:update">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={handleResetPassword}
                    >
                      <Key className="mr-2 h-4 w-4" />
                      Send Password Reset Email
                    </Button>
                  </PermissionGate>

                  <PermissionGate slug="users:suspend">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={handleSuspend}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      {user.isActive ? 'Suspend Account' : 'Reactivate Account'}
                    </Button>
                  </PermissionGate>

                  <PermissionGate slug="users:delete">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full justify-start">
                          <Mail className="mr-2 h-4 w-4" />
                          Delete User (Soft)
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The user will be soft-deleted and cannot log in. Their data and audit
                            history are preserved. This cannot be undone through the UI.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </PermissionGate>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
