'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PermissionGate } from '@/components/permission-gate'
import { Plus, Pencil, Trash2, FolderOpen, Loader2 } from 'lucide-react'

type DeptRow = {
  id: string
  name: string
  description: string | null
  parentId: string | null
  manager: { id: string; name: string } | null
  _count: { users: number; children: number }
}

type UserOption = { id: string; name: string }

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DeptRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DeptRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', parentId: '', managerId: '' })

  async function fetchDepts() {
    const [dr, ur] = await Promise.all([
      fetch('/api/departments').then((r) => r.json()),
      fetch('/api/users?pageSize=100').then((r) => r.json()),
    ])
    if (dr.success) setDepartments(dr.data)
    if (ur.success) setUsers(ur.data)
    setLoading(false)
  }

  useEffect(() => {
    void fetchDepts() // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', parentId: '', managerId: '' })
    setDialogOpen(true)
  }

  function openEdit(dept: DeptRow) {
    setEditing(dept)
    setForm({
      name: dept.name,
      description: dept.description ?? '',
      parentId: dept.parentId ?? '',
      managerId: dept.manager?.id ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        parentId: form.parentId || null,
        managerId: form.managerId || null,
      }
      const res = editing
        ? await fetch(`/api/departments/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const data = await res.json()
      if (data.success) {
        toast.success(editing ? 'Department updated' : 'Department created')
        setDialogOpen(false)
        fetchDepts()
      } else {
        toast.error(data.error)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(dept: DeptRow) {
    const res = await fetch(`/api/departments/${dept.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      toast.success('Department deleted')
      fetchDepts()
    } else {
      toast.error(data.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground text-sm">Organize your team into departments</p>
        </div>
        <PermissionGate slug="departments:create">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Department
          </Button>
        </PermissionGate>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                      No departments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((dept) => {
                    const parent = departments.find((d) => d.id === dept.parentId)
                    return (
                      <TableRow key={dept.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FolderOpen className="text-muted-foreground h-4 w-4" />
                            <div>
                              <p className="font-medium">{dept.name}</p>
                              {dept.description && (
                                <p className="text-muted-foreground text-xs">{dept.description}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {parent?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">{dept.manager?.name ?? '—'}</TableCell>
                        <TableCell className="text-sm">{dept._count.users}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <PermissionGate slug="departments:update">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate slug="departments:delete">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={dept._count.users > 0}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete &quot;{dept.name}&quot;?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      The department will be removed. Users will need to be
                                      reassigned.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(dept)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Department' : 'New Department'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Department</Label>
              <Select
                value={form.parentId || '__none__'}
                onValueChange={(v) => setForm({ ...form, parentId: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Top-level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Top-level</SelectItem>
                  {departments
                    .filter((d) => d.id !== editing?.id)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Manager</Label>
              <Select
                value={form.managerId || '__none__'}
                onValueChange={(v) => setForm({ ...form, managerId: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No manager</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
