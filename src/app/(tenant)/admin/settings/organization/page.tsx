'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const TIMEZONES = [
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC',
]

const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'CAD', 'AUD']

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY']

type OrgData = {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  email: string
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string
  postalCode: string | null
  ntn: string | null
  strn: string | null
  currency: string
  locale: string
  timezone: string
  dateFormat: string
  fiscalYearStart: number
  billingEmail: string | null
  billingName: string | null
  billingPhone: string | null
  trialEndsAt: string | null
  nextBillingDate: string | null
}

export default function OrganizationSettingsPage() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/organization')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setOrg(d.data)
        setLoading(false)
      })
  }, [])

  function set(field: keyof OrgData, value: string | number | null) {
    setOrg((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  async function handleSave() {
    if (!org) return
    setSaving(true)
    try {
      const res = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: org.name,
          phone: org.phone,
          website: org.website,
          address: org.address,
          city: org.city,
          state: org.state,
          country: org.country,
          postalCode: org.postalCode,
          ntn: org.ntn,
          strn: org.strn,
          currency: org.currency,
          timezone: org.timezone,
          dateFormat: org.dateFormat,
          fiscalYearStart: org.fiscalYearStart,
          billingEmail: org.billingEmail,
          billingName: org.billingName,
          billingPhone: org.billingPhone,
        }),
      })
      const data = await res.json()
      if (data.success) toast.success('Settings saved')
      else toast.error(data.error)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  if (!org) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organization Settings</h1>
          <p className="text-muted-foreground text-sm">
            {org.slug} · <Badge variant="outline">{org.plan}</Badge> · <Badge>{org.status}</Badge>
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input value={org.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={org.website ?? ''}
                onChange={(e) => set('website', e.target.value || null)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={org.phone ?? ''}
                onChange={(e) => set('phone', e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={org.address ?? ''}
                onChange={(e) => set('address', e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={org.city ?? ''} onChange={(e) => set('city', e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={org.country}
                onChange={(e) => set('country', e.target.value)}
                maxLength={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tax Info */}
        <Card>
          <CardHeader>
            <CardTitle>Tax & Legal</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>NTN</Label>
              <Input
                value={org.ntn ?? ''}
                onChange={(e) => set('ntn', e.target.value || null)}
                placeholder="1234567-8"
              />
            </div>
            <div className="space-y-2">
              <Label>STRN</Label>
              <Input
                value={org.strn ?? ''}
                onChange={(e) => set('strn', e.target.value || null)}
                placeholder="12-34-5678-001-24"
              />
            </div>
          </CardContent>
        </Card>

        {/* Locale */}
        <Card>
          <CardHeader>
            <CardTitle>Locale & Date Format</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={org.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={org.timezone} onValueChange={(v) => set('timezone', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select value={org.dateFormat} onValueChange={(v) => set('dateFormat', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fiscal Year Start (month)</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={org.fiscalYearStart}
                onChange={(e) => set('fiscalYearStart', parseInt(e.target.value) || 1)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Billing Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Billing Email</Label>
              <Input
                value={org.billingEmail ?? ''}
                onChange={(e) => set('billingEmail', e.target.value || null)}
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Billing Name</Label>
              <Input
                value={org.billingName ?? ''}
                onChange={(e) => set('billingName', e.target.value || null)}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-fit">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
