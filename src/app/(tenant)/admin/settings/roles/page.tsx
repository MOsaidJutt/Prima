'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Plus, Shield, Trash2, Pencil, Lock } from 'lucide-react'

type RoleRow = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
  _count: { users: number }
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([])

  async function fetchRoles() {
    const res = await fetch('/api/roles')
    const data = await res.json()
    if (data.success) setRoles(data.data)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void fetchRoles()
  }, [])

  async function handleDelete(id: string, name: string) {
    const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      toast.success(`Role "${name}" deleted`)
      fetchRoles()
    } else {
      toast.error(data.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground text-sm">
            System roles are read-only. Custom roles can be created and edited.
          </p>
        </div>
        <PermissionGate slug="roles:create">
          <Button asChild>
            <Link href="/admin/settings/roles/new">
              <Plus className="mr-2 h-4 w-4" />
              New Role
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Users</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Shield className="text-muted-foreground h-4 w-4" />
                      <div>
                        <p className="font-medium">{role.name}</p>
                        {role.description && (
                          <p className="text-muted-foreground text-xs">{role.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {role.isSystem ? (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" /> System
                      </Badge>
                    ) : (
                      <Badge variant="outline">Custom</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">
                      {role.permissions.includes('*')
                        ? 'All permissions'
                        : `${role.permissions.length} permissions`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{role._count.users}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!role.isSystem && (
                        <>
                          <PermissionGate slug="roles:update">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/admin/settings/roles/${role.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          </PermissionGate>
                          <PermissionGate slug="roles:delete">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={role._count.users > 0}
                                  title={
                                    role._count.users > 0 ? 'Reassign users first' : 'Delete role'
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete role &quot;{role.name}&quot;?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This cannot be undone. All permission settings will be lost.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(role.id, role.name)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </PermissionGate>
                        </>
                      )}
                      {role.isSystem && (
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/admin/settings/roles/${role.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
