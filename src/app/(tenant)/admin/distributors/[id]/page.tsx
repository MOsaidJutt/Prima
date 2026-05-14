'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionGate } from '@/components/permission-gate'
import { EntityCard } from '@/components/entity-card'
import { ChevronLeft, Edit, Trash2, Phone, Mail, MapPin, Star } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Distributor = {
  id: string
  code: string
  companyName: string
  contactName: string | null
  email: string | null
  phone: string | null
  phone2: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string
  postalCode: string | null
  ntn: string | null
  strn: string | null
  bankName: string | null
  bankAccount: string | null
  bankBranch: string | null
  iban: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'
  tier: 'GOLD' | 'SILVER' | 'BRONZE'
  creditLimit: number
  currentBalance: number
  totalPurchases: number
  rating: number
  paymentTerms: number
  tags: string[]
  notes: string | null
  createdAt: string
  clients: Array<{
    id: string
    code: string
    companyName: string
    status: string
    city: string | null
    lastOrderDate: string | null
  }>
  attachments: Array<{
    id: string
    name: string
    fileUrl: string
    mimeType: string
    sizeBytes: number
  }>
  inventoryTransactions: Array<{
    id: string
    type: string
    quantity: number
    createdAt: string
    product: { name: string; sku: string }
    toWarehouse: { name: string } | null
  }>
}

const STATUS_COLORS = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  BLACKLISTED: 'destructive',
} as const

export default function DistributorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [distributor, setDistributor] = useState<Distributor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/distributors/${id}`)
      .then((r) => r.json())
      .then(setDistributor)
      .catch(() => toast.error('Failed to load distributor'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!confirm('Delete this distributor?')) return
    const res = await fetch(`/api/v1/distributors/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deleted')
      router.push('/admin/distributors')
    } else toast.error('Delete failed')
  }

  if (loading) return <div className="p-6 text-center">Loading…</div>
  if (!distributor) return <div className="p-6 text-center">Distributor not found.</div>

  const utilizationPct =
    distributor.creditLimit > 0
      ? Math.min(100, (distributor.currentBalance / distributor.creditLimit) * 100)
      : 0

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/distributors"
            className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Distributors
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{distributor.companyName}</h1>
            <Badge variant={STATUS_COLORS[distributor.status]}>{distributor.status}</Badge>
            <span className="text-muted-foreground font-mono text-sm">{distributor.code}</span>
          </div>
          {distributor.contactName && (
            <p className="text-muted-foreground">{distributor.contactName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <PermissionGate slug="distributors:update">
            <Button variant="outline" asChild>
              <Link href={`/admin/distributors/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate slug="distributors:delete">
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Balance</p>
            <p className="text-xl font-bold">
              PKR {Number(distributor.currentBalance).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Credit Limit</p>
            <p className="text-xl font-bold">
              PKR {Number(distributor.creditLimit).toLocaleString()}
            </p>
            <div className="bg-muted mt-1 h-1.5 w-full rounded-full">
              <div
                className="bg-primary h-1.5 rounded-full"
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Total Purchases</p>
            <p className="text-xl font-bold">
              PKR {Number(distributor.totalPurchases).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Rating</p>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <p className="text-xl font-bold">{Number(distributor.rating).toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clients">Clients ({distributor.clients.length})</TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions ({distributor.inventoryTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="attachments">
            Attachments ({distributor.attachments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {distributor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="text-muted-foreground h-4 w-4" />
                    {distributor.email}
                  </div>
                )}
                {distributor.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="text-muted-foreground h-4 w-4" />
                    {distributor.phone}
                  </div>
                )}
                {distributor.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="text-muted-foreground h-4 w-4" />
                    {[distributor.address, distributor.city, distributor.state, distributor.country]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Financial Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Terms</span>
                  <span>{distributor.paymentTerms} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tier</span>
                  <span className="font-medium">{distributor.tier}</span>
                </div>
                {distributor.ntn && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NTN</span>
                    <span>{distributor.ntn}</span>
                  </div>
                )}
                {distributor.bankName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span>{distributor.bankName}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {distributor.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{distributor.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clients" className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {distributor.clients.length === 0 ? (
              <p className="text-muted-foreground col-span-2 py-8 text-center text-sm">
                No linked clients yet.
              </p>
            ) : (
              distributor.clients.map((c) => (
                <EntityCard
                  key={c.id}
                  type="client"
                  id={c.id}
                  name={c.companyName}
                  code={c.code}
                  subtitle={c.city ?? undefined}
                  badge={{ label: c.status }}
                  meta={
                    c.lastOrderDate
                      ? [
                          {
                            label: 'Last Order',
                            value: formatDistanceToNow(new Date(c.lastOrderDate), {
                              addSuffix: true,
                            }),
                          },
                        ]
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="pt-4">
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {distributor.inventoryTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground py-8 text-center">
                      No transactions.
                    </td>
                  </tr>
                ) : (
                  distributor.inventoryTransactions.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2">
                        {t.product.name}{' '}
                        <span className="text-muted-foreground text-xs">{t.product.sku}</span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{t.type}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{t.quantity}</td>
                      <td className="text-muted-foreground px-3 py-2">
                        {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="attachments" className="pt-4">
          {distributor.attachments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No attachments.</p>
          ) : (
            <div className="grid gap-2">
              {distributor.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-muted/40 hover:bg-muted flex items-center gap-3 rounded-md px-4 py-3 text-sm transition-colors"
                >
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="text-muted-foreground">
                    {(a.sizeBytes / 1024).toFixed(0)} KB
                  </span>
                </a>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
