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
import { ClientFinancialsTab } from '@/components/client-financials-tab'
import { UpsellTab } from '@/components/ai/upsell-tab'
import { PaymentBehaviorBadge } from '@/components/ai/payment-behavior-badge'
import {
  ChevronLeft,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react'
import { differenceInDays } from 'date-fns'

type Client = {
  id: string
  code: string
  companyName: string
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string
  ntn: string | null
  strn: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'CHURNED'
  businessType: string | null
  businessSize: string | null
  industry: string | null
  creditLimit: number
  currentBalance: number
  paymentTerms: number
  totalLifetimeValue: number
  totalOrders: number
  averageOrderValue: number
  firstOrderDate: string | null
  lastOrderDate: string | null
  paymentBehaviorScore: number | null
  paymentBehaviorLabel: string | null
  notes: string | null
  distributor: { id: string; code: string; companyName: string } | null
  assignedRep: { id: string; name: string; email: string } | null
  attachments: Array<{ id: string; name: string; fileUrl: string; sizeBytes: number }>
}

const STATUS_COLORS = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  PROSPECT: 'outline',
  CHURNED: 'destructive',
} as const

const SCORE_LABEL_COLORS: Record<string, string> = {
  EXCELLENT: 'bg-green-100 text-green-800',
  GOOD: 'bg-blue-100 text-blue-800',
  AVERAGE: 'bg-yellow-100 text-yellow-800',
  RISKY: 'bg-orange-100 text-orange-800',
  DEFAULTER: 'bg-red-100 text-red-800',
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/clients/${id}`)
      .then((r) => r.json())
      .then(setClient)
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!confirm('Delete this client?')) return
    const res = await fetch(`/api/v1/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deleted')
      router.push('/admin/clients')
    } else toast.error('Delete failed')
  }

  if (loading) return <div className="p-6 text-center">Loading…</div>
  if (!client) return <div className="p-6 text-center">Client not found.</div>

  const daysSinceOrder = client.lastOrderDate
    ? differenceInDays(new Date(), new Date(client.lastOrderDate))
    : null
  const churnRisk =
    daysSinceOrder !== null && daysSinceOrder > 60
      ? 'HIGH'
      : daysSinceOrder !== null && daysSinceOrder > 30
        ? 'MEDIUM'
        : 'LOW'

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/clients"
            className="text-muted-foreground hover:text-foreground mb-2 flex items-center text-sm"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Clients
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{client.companyName}</h1>
            <Badge variant={STATUS_COLORS[client.status]}>{client.status}</Badge>
            <span className="text-muted-foreground font-mono text-sm">{client.code}</span>
          </div>
          {client.contactName && <p className="text-muted-foreground">{client.contactName}</p>}
        </div>
        <div className="flex gap-2">
          <PermissionGate slug="clients:update">
            <Button variant="outline" asChild>
              <Link href={`/admin/clients/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate slug="clients:delete">
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Client Intelligence (Phase 2 placeholders) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Lifetime Value</p>
            <p className="text-xl font-bold">
              PKR {Number(client.totalLifetimeValue).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Total Orders</p>
            <p className="text-xl font-bold">{client.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Payment Score</p>
            {client.paymentBehaviorScore != null ? (
              <div>
                <p className="text-xl font-bold">{client.paymentBehaviorScore}</p>
                <PaymentBehaviorBadge
                  score={client.paymentBehaviorScore}
                  label={client.paymentBehaviorLabel}
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Computed in Phase 6</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" /> Churn Risk
            </p>
            <Badge
              variant={
                churnRisk === 'HIGH'
                  ? 'destructive'
                  : churnRisk === 'MEDIUM'
                    ? 'outline'
                    : 'secondary'
              }
            >
              {churnRisk}
            </Badge>
            {daysSinceOrder !== null && (
              <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" /> {daysSinceOrder}d ago
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="suggested" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            Suggested
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="attachments">Attachments ({client.attachments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="financials" className="space-y-4 pt-4">
          <ClientFinancialsTab clientId={id} creditLimit={client.creditLimit} />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {client.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="text-muted-foreground h-4 w-4" />
                    {client.email}
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="text-muted-foreground h-4 w-4" />
                    {client.phone}
                  </div>
                )}
                {client.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="text-muted-foreground h-4 w-4" />
                    {[client.address, client.city, client.country].filter(Boolean).join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Business</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {client.businessType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span>{client.businessType}</span>
                  </div>
                )}
                {client.businessSize && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span>{client.businessSize}</span>
                  </div>
                )}
                {client.industry && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Industry</span>
                    <span>{client.industry}</span>
                  </div>
                )}
                {client.distributor && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distributor</span>
                    <Link
                      href={`/admin/distributors/${client.distributor.id}`}
                      className="hover:underline"
                    >
                      {client.distributor.companyName}
                    </Link>
                  </div>
                )}
                {client.assignedRep && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sales Rep</span>
                    <span>{client.assignedRep.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Terms</span>
                  <span>{client.paymentTerms} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Order</span>
                  <span>PKR {Number(client.averageOrderValue).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="pt-4">
          <p className="text-muted-foreground py-12 text-center text-sm">
            Order history will be available after Phase 3 (DSR & Invoicing).
          </p>
        </TabsContent>

        <TabsContent value="invoices" className="pt-4">
          <p className="text-muted-foreground py-12 text-center text-sm">
            Invoice history will be available after Phase 3.
          </p>
        </TabsContent>

        <TabsContent value="suggested" className="pt-4">
          <UpsellTab clientId={id} />
        </TabsContent>

        <TabsContent value="notes" className="pt-4">
          <Card>
            <CardContent className="pt-4">
              {client.notes ? (
                <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
              ) : (
                <p className="text-muted-foreground text-sm">No notes.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="pt-4">
          {client.attachments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No attachments.</p>
          ) : (
            <div className="grid gap-2">
              {client.attachments.map((a) => (
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
