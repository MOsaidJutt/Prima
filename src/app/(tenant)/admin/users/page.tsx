'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { PermissionGate } from '@/components/permission-gate'
import { UserPlus, MoreHorizontal, Search, Loader2, RefreshCw } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'

type UserRow = {
  id: string
  name: string
  email: string
  avatar: string | null
  isActive: boolean
  lastLoginAt: string | null
  role: { id: string; name: string }
  department: { id: string; name: string } | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (q) params.set('q', q)
      if (roleFilter) params.set('roleId', roleFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.data)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [q, roleFilter, statusFilter, page])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    fetch('/api/roles')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setRoles(d.data)
      })
  }, [])

  async function handleBulkAction(action: string) {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids }),
    })
    const data = await res.json()
    if (data.success) {
      toast.success(`${data.affected} user(s) updated`)
      setSelected(new Set())
      fetchUsers()
    } else {
      toast.error(data.error)
    }
  }

  async function handleSuspend(userId: string) {
    const res = await fetch(`/api/users/${userId}/suspend`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      toast.success(data.isActive ? 'User activated' : 'User suspended')
      fetchUsers()
    } else {
      toast.error(data.error)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = users.length > 0 && users.every((u) => selected.has(u.id))
  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(users.map((u) => u.id)))
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm">{total} total</p>
        </div>
        <PermissionGate slug="users:invite">
          <Button asChild>
            <Link href="/admin/users/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v === 'all' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v === 'all' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={fetchUsers}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {selected.size > 0 && (
            <div className="bg-muted flex items-center gap-2 rounded-md p-2">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <PermissionGate slug="users:update">
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('deactivate')}>
                  Suspend
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('activate')}>
                  Activate
                </Button>
              </PermissionGate>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(user.id)}
                          onCheckedChange={() => toggleSelect(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {user.avatar && <AvatarImage src={user.avatar} />}
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {user.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link
                              href={`/admin/users/${user.id}`}
                              className="font-medium hover:underline"
                            >
                              {user.name}
                            </Link>
                            <p className="text-muted-foreground text-xs">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role.name}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.department?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isActive ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {user.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.lastLoginAt
                          ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/users/${user.id}`}>View details</Link>
                            </DropdownMenuItem>
                            <PermissionGate slug="users:suspend">
                              <DropdownMenuItem onClick={() => handleSuspend(user.id)}>
                                {user.isActive ? 'Suspend' : 'Activate'}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate slug="users:update">
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/users/${user.id}`}>Edit</Link>
                              </DropdownMenuItem>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-sm">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
