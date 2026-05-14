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

type Distributor = {
  id: string
  code: string
  companyName: string
  contactName: string | null
  email: string | null
  phone: string | null
  city: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'
  tier: 'GOLD' | 'SILVER' | 'BRONZE'
  currentBalance: number
  rating: number
  creditLimit: number
  createdAt: string
  _count: { clients: number }
}

const STATUS_COLORS = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  BLACKLISTED: 'destructive',
} as const

const TIER_COLORS = {
  GOLD: 'bg-yellow-100 text-yellow-800',
  SILVER: 'bg-gray-100 text-gray-800',
  BRONZE: 'bg-orange-100 text-orange-800',
} as const

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [tier, setTier] = useState('all')
  const [_selected, setSelected] = useState<string[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const PAGE_SIZE = 25

  const fetch = useCallback(
    async (p = page) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(PAGE_SIZE),
          ...(search && { search }),
          ...(status !== 'all' && { status }),
          ...(tier !== 'all' && { tier }),
        })
        const res = await window.fetch(`/api/v1/distributors?${params}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setDistributors(data.distributors)
        setTotal(data.total)
      } catch {
        toast.error('Failed to load distributors')
      } finally {
        setLoading(false)
      }
    },
    [page, search, status, tier]
  )

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetch(1)
    setPage(1)
  }, [status, tier])

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetch(1)
      setPage(1)
    }, 400)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetch(page)
  }, [page])

  async function handleDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} distributor(s)?`)) return
    await Promise.all(
      ids.map((id) => window.fetch(`/api/v1/distributors/${id}`, { method: 'DELETE' }))
    )
    toast.success(`${ids.length} deleted`)
    setSelected([])
    fetch(page)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await window.fetch('/api/v1/distributors/import', { method: 'POST', body: fd })
      const data = await res.json()
      toast.success(
        `Imported ${data.created} distributors${data.skipped ? ` (${data.skipped} skipped)` : ''}`
      )
      if (data.errors?.length) toast.error(data.errors[0])
      fetch(1)
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
          <h1 className="text-2xl font-bold">Distributors</h1>
          <p className="text-muted-foreground text-sm">{total} distributors</p>
        </div>
        <div className="flex gap-2">
          <PermissionGate slug="distributors:create">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button asChild>
              <Link href="/admin/distributors/new">
                <Plus className="mr-2 h-4 w-4" /> New Distributor
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Filters */}
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
                <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="GOLD">Gold</SelectItem>
                <SelectItem value="SILVER">Silver</SelectItem>
                <SelectItem value="BRONZE">Bronze</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <DataTable
        data={distributors}
        loading={loading}
        selectable
        onSelectionChange={setSelected}
        exportFilename="distributors"
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
            label: 'Company',
            sortable: true,
            render: (r) => (
              <div>
                <Link href={`/admin/distributors/${r.id}`} className="font-medium hover:underline">
                  {r.companyName}
                </Link>
                {r.contactName && <p className="text-muted-foreground text-xs">{r.contactName}</p>}
              </div>
            ),
          },
          {
            key: 'city',
            label: 'Location',
            sortable: true,
            render: (r) => r.city ?? '—',
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (r) => <Badge variant={STATUS_COLORS[r.status]}>{r.status}</Badge>,
          },
          {
            key: 'tier',
            label: 'Tier',
            render: (r) => (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[r.tier]}`}
              >
                {r.tier}
              </span>
            ),
          },
          {
            key: 'currentBalance',
            label: 'Balance',
            sortable: true,
            render: (r) => (
              <span className="font-mono">PKR {Number(r.currentBalance).toLocaleString()}</span>
            ),
          },
          {
            key: '_count',
            label: 'Clients',
            render: (r) => r._count.clients,
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
                    <Link href={`/admin/distributors/${r.id}`}>View</Link>
                  </DropdownMenuItem>
                  <PermissionGate slug="distributors:update">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/distributors/${r.id}/edit`}>Edit</Link>
                    </DropdownMenuItem>
                  </PermissionGate>
                  <PermissionGate slug="distributors:delete">
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
        emptyMessage="No distributors found. Import or create your first distributor."
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Distributors</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Upload a CSV or Excel file with columns: <strong>Company Name</strong>, Contact Name,
              Email, Phone, City, Credit Limit, Payment Terms.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="/templates/distributors-import.csv" download>
                Download Template
              </a>
            </Button>
            <label className="block">
              <Button type="button" variant="outline" className="w-full" disabled={importing}>
                {importing ? 'Importing…' : 'Choose File (.csv, .xlsx)'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={handleImport}
              />
            </label>
            <Button
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Select & Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
