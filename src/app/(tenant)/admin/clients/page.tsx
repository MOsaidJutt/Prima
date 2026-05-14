'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PermissionGate } from '@/components/permission-gate'
import { DataTable, Pagination } from '@/components/data-table'
import { Plus, Upload, Search, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'

type Client = {
  id: string
  code: string
  companyName: string
  contactName: string | null
  email: string | null
  phone: string | null
  city: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'CHURNED'
  businessType: string | null
  totalLifetimeValue: number
  lastOrderDate: string | null
  paymentBehaviorScore: number | null
  distributor: { companyName: string } | null
  assignedRep: { name: string } | null
}

const STATUS_COLORS = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  PROSPECT: 'outline',
  CHURNED: 'destructive',
} as const

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const PAGE_SIZE = 25

  const fetchData = useCallback(
    async (p = page) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(PAGE_SIZE),
          ...(search && { search }),
          ...(status !== 'all' && { status }),
        })
        const res = await window.fetch(`/api/v1/clients?${params}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setClients(data.clients)
        setTotal(data.total)
      } catch {
        toast.error('Failed to load clients')
      } finally {
        setLoading(false)
      }
    },
    [page, search, status]
  )

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchData(1)
    setPage(1)
  }, [status])
  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetchData(1)
      setPage(1)
    }, 400)
    return () => clearTimeout(searchTimer.current)
  }, [search])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchData(page)
  }, [page])

  async function handleDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} client(s)?`)) return
    await Promise.all(ids.map((id) => window.fetch(`/api/v1/clients/${id}`, { method: 'DELETE' })))
    toast.success('Deleted')
    fetchData(page)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await window.fetch('/api/v1/clients/import', { method: 'POST', body: fd })
      const data = await res.json()
      toast.success(`Imported ${data.created} clients`)
      if (data.errors?.length) toast.error(data.errors[0])
      fetchData(1)
      setPage(1)
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
      setImportOpen(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground text-sm">{total} clients</p>
        </div>
        <div className="flex gap-2">
          <PermissionGate slug="clients:create">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button asChild>
              <Link href="/admin/clients/new">
                <Plus className="mr-2 h-4 w-4" />
                New Client
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name, code, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="PROSPECT">Prospect</SelectItem>
                <SelectItem value="CHURNED">Churned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        data={clients}
        loading={loading}
        selectable
        exportFilename="clients"
        bulkActions={[{ label: 'Delete Selected', onClick: handleDelete, destructive: true }]}
        columns={[
          {
            key: 'code',
            label: 'Code',
            sortable: true,
            render: (r) => <span className="font-mono text-xs">{r.code}</span>,
          },
          {
            key: 'companyName',
            label: 'Client',
            sortable: true,
            render: (r) => (
              <div>
                <Link href={`/admin/clients/${r.id}`} className="font-medium hover:underline">
                  {r.companyName}
                </Link>
                {r.contactName && <p className="text-muted-foreground text-xs">{r.contactName}</p>}
              </div>
            ),
          },
          { key: 'city', label: 'Location', sortable: true, render: (r) => r.city ?? '—' },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (r) => <Badge variant={STATUS_COLORS[r.status]}>{r.status}</Badge>,
          },
          {
            key: 'distributor',
            label: 'Distributor',
            render: (r) => r.distributor?.companyName ?? '—',
          },
          { key: 'assignedRep', label: 'Sales Rep', render: (r) => r.assignedRep?.name ?? '—' },
          {
            key: 'totalLifetimeValue',
            label: 'LTV',
            sortable: true,
            render: (r) => (
              <span className="font-mono">PKR {Number(r.totalLifetimeValue).toLocaleString()}</span>
            ),
          },
          {
            key: 'lastOrderDate',
            label: 'Last Order',
            render: (r) =>
              r.lastOrderDate
                ? formatDistanceToNow(new Date(r.lastOrderDate), { addSuffix: true })
                : '—',
          },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/clients/${r.id}`}>View</Link>
                  </DropdownMenuItem>
                  <PermissionGate slug="clients:update">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/clients/${r.id}/edit`}>Edit</Link>
                    </DropdownMenuItem>
                  </PermissionGate>
                  <PermissionGate slug="clients:delete">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete([r.id])}
                    >
                      Delete
                    </DropdownMenuItem>
                  </PermissionGate>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
        emptyMessage="No clients found."
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Clients</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Upload CSV/Excel with: <strong>Company Name</strong>, Contact Name, Email, Phone,
              City.
            </p>
            <label className="block">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                {importing ? 'Importing…' : 'Select File (.csv, .xlsx)'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={handleImport}
              />
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
