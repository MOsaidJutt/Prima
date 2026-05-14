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
import { Plus, Search, MoreHorizontal, Package, AlertTriangle } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Product = {
  id: string
  sku: string
  name: string
  brand: string | null
  sellingPrice: number
  costPrice: number
  reorderLevel: number
  status: string
  images: string[]
  totalStock: number
  isLowStock: boolean
  category: { name: string } | null
}

const STATUS_COLORS = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  DISCONTINUED: 'destructive',
} as const

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [categoryId, setCategoryId] = useState('all')
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
          ...(categoryId !== 'all' && { categoryId }),
        })
        const res = await window.fetch(`/api/v1/products?${params}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setProducts(data.products)
        setTotal(data.total)
      } catch {
        toast.error('Failed to load')
      } finally {
        setLoading(false)
      }
    },
    [page, search, status, categoryId]
  )

  useEffect(() => {
    fetch('/api/v1/products/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchData(1)
    setPage(1)
  }, [status, categoryId])
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
    if (!confirm(`Delete ${ids.length} product(s)?`)) return
    await Promise.all(ids.map((id) => window.fetch(`/api/v1/products/${id}`, { method: 'DELETE' })))
    toast.success('Deleted')
    fetchData(page)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm">{total} products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/products/categories">Categories</Link>
          </Button>
          <PermissionGate slug="products:create">
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus className="mr-2 h-4 w-4" />
                New Product
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
                placeholder="Search by name, SKU, barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        data={products}
        loading={loading}
        selectable
        exportFilename="products"
        bulkActions={[{ label: 'Delete Selected', onClick: handleDelete, destructive: true }]}
        columns={[
          {
            key: 'sku',
            label: 'SKU',
            sortable: true,
            render: (r) => (
              <div className="flex items-center gap-2">
                {r.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded">
                    <Package className="text-muted-foreground h-4 w-4" />
                  </div>
                )}
                <span className="font-mono text-xs">{r.sku}</span>
              </div>
            ),
          },
          {
            key: 'name',
            label: 'Product',
            sortable: true,
            render: (r) => (
              <div>
                <Link href={`/admin/products/${r.id}/edit`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                {r.brand && <p className="text-muted-foreground text-xs">{r.brand}</p>}
              </div>
            ),
          },
          { key: 'category', label: 'Category', render: (r) => r.category?.name ?? '—' },
          {
            key: 'sellingPrice',
            label: 'Price',
            sortable: true,
            render: (r) => (
              <span className="font-mono">PKR {Number(r.sellingPrice).toLocaleString()}</span>
            ),
          },
          {
            key: 'totalStock',
            label: 'Stock',
            sortable: true,
            render: (r) => (
              <div className="flex items-center gap-1">
                {r.isLowStock && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                <span className={r.isLowStock ? 'font-medium text-orange-600' : ''}>
                  {r.totalStock}
                </span>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <Badge variant={STATUS_COLORS[r.status as keyof typeof STATUS_COLORS]}>
                {r.status}
              </Badge>
            ),
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
                    <Link href={`/admin/products/${r.id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/inventory/adjust?productId=${r.id}`}>Adjust Stock</Link>
                  </DropdownMenuItem>
                  <PermissionGate slug="products:delete">
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
        emptyMessage="No products found."
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  )
}
