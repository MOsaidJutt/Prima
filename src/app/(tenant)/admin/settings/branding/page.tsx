'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Loader2, Upload, Eye } from 'lucide-react'

const GOOGLE_FONTS = [
  'Plus Jakarta Sans',
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Nunito',
  'Montserrat',
  'Raleway',
  'Merriweather',
  'Playfair Display',
  'DM Sans',
  'Manrope',
  'Work Sans',
  'Fira Sans',
  'Noto Sans',
  'Source Sans 3',
  'Quicksand',
  'Josefin Sans',
  'Cabin',
]

type BrandingData = {
  logoLight: string | null
  logoDark: string | null
  favicon: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  emailBannerUrl: string | null
  emailFooterText: string | null
  loginCustomText: string | null
}

export default function BrandingPage() {
  const [data, setData] = useState<BrandingData>({
    logoLight: null,
    logoDark: null,
    favicon: null,
    primaryColor: '#0F172A',
    secondaryColor: '#334155',
    accentColor: '#0369A1',
    fontFamily: 'Plus Jakarta Sans',
    emailBannerUrl: null,
    emailFooterText: null,
    loginCustomText: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const logoLightRef = useRef<HTMLInputElement>(null)
  const logoDarkRef = useRef<HTMLInputElement>(null)
  const faviconRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/branding')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData((prev) => ({ ...prev, ...d.data }))
        setLoading(false)
      })
  }, [])

  function set(field: keyof BrandingData, value: string | null) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  async function uploadFile(file: File, field: 'logoLight' | 'logoDark' | 'favicon') {
    setUploadingField(field)
    try {
      // 1. Get pre-signed URL
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          category: 'branding',
        }),
      })
      const presignData = await presignRes.json()
      if (!presignData.success) {
        toast.error(presignData.error)
        return
      }

      // 2. Upload directly to R2
      const uploadRes = await fetch(presignData.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) {
        toast.error('Upload failed')
        return
      }

      set(field, presignData.data.publicUrl)
      toast.success('File uploaded')
    } finally {
      setUploadingField(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('Branding saved. Refresh to see new colors applied.')
      } else {
        toast.error(result.error)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branding & Customization</h1>
        <p className="text-muted-foreground text-sm">
          Changes apply across the app for all users of your organization.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Settings column */}
        <div className="space-y-6 lg:col-span-3">
          {/* Logos */}
          <Card>
            <CardHeader>
              <CardTitle>Logos</CardTitle>
              <CardDescription>PNG, SVG, or WebP. Max 5 MB.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(['logoLight', 'logoDark', 'favicon'] as const).map((field) => {
                const label =
                  field === 'logoLight'
                    ? 'Logo (Light)'
                    : field === 'logoDark'
                      ? 'Logo (Dark)'
                      : 'Favicon'
                const inputRef =
                  field === 'logoLight'
                    ? logoLightRef
                    : field === 'logoDark'
                      ? logoDarkRef
                      : faviconRef
                return (
                  <div key={field} className="space-y-2">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-3">
                      {data[field] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={data[field]!}
                          alt={label}
                          className="h-10 w-auto rounded border object-contain"
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploadingField === field}
                      >
                        {uploadingField === field ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Upload
                      </Button>
                      {data[field] && (
                        <Button variant="ghost" size="sm" onClick={() => set(field, null)}>
                          Remove
                        </Button>
                      )}
                    </div>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadFile(file, field)
                      }}
                    />
                    {data[field] && (
                      <Input
                        value={data[field] ?? ''}
                        onChange={(e) => set(field, e.target.value)}
                        placeholder="https://..."
                        className="text-xs"
                      />
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  ['primaryColor', 'Primary Color', 'Sidebar, buttons, key elements'],
                  ['secondaryColor', 'Secondary Color', 'Secondary UI elements'],
                  ['accentColor', 'Accent Color', 'CTA highlights, links, active states'],
                ] as const
              ).map(([field, label, hint]) => (
                <div key={field} className="space-y-1">
                  <Label>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={data[field]}
                      onChange={(e) => set(field, e.target.value)}
                      className="border-input h-9 w-12 cursor-pointer rounded border"
                    />
                    <Input
                      value={data[field]}
                      onChange={(e) => set(field, e.target.value)}
                      className="w-32 font-mono"
                      maxLength={7}
                    />
                    <span className="text-muted-foreground text-xs">{hint}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Font */}
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select value={data.fontFamily} onValueChange={(v) => set('fontFamily', v)}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOOGLE_FONTS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">Loaded from Google Fonts.</p>
              </div>
            </CardContent>
          </Card>

          {/* Email branding */}
          <Card>
            <CardHeader>
              <CardTitle>Email Branding</CardTitle>
              <CardDescription>
                Applied to all system emails sent from your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email Banner Image URL</Label>
                <Input
                  value={data.emailBannerUrl ?? ''}
                  onChange={(e) => set('emailBannerUrl', e.target.value || null)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Email Footer Text</Label>
                <Textarea
                  value={data.emailFooterText ?? ''}
                  onChange={(e) => set('emailFooterText', e.target.value || null)}
                  placeholder="© 2025 ACME Corp. All rights reserved."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Login Page Custom Message</Label>
                <Input
                  value={data.loginCustomText ?? ''}
                  onChange={(e) => set('loginCustomText', e.target.value || null)}
                  placeholder="Sign in to your ACME workspace"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Branding
          </Button>
        </div>

        {/* Live preview column */}
        <div className="lg:col-span-2">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="overflow-hidden rounded-lg border"
                style={{ fontFamily: data.fontFamily }}
              >
                {/* Mock sidebar */}
                <div className="flex h-48">
                  <div
                    className="flex w-24 flex-col gap-2 p-2"
                    style={{ backgroundColor: data.primaryColor }}
                  >
                    {data.logoLight ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.logoLight} alt="Logo" className="h-6 w-auto object-contain" />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white">
                        P
                      </div>
                    )}
                    {['Dashboard', 'Users', 'Settings'].map((item) => (
                      <div
                        key={item}
                        className="rounded px-2 py-1 text-[10px]"
                        style={{ color: 'white', opacity: 0.8 }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                  {/* Mock content */}
                  <div className="flex-1 bg-white p-3">
                    <div
                      className="mb-2 text-xs font-semibold"
                      style={{ color: data.primaryColor }}
                    >
                      Dashboard
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {['Revenue', 'Users'].map((label) => (
                        <div key={label} className="rounded border p-2">
                          <div className="text-[10px] text-gray-400">{label}</div>
                          <div className="text-sm font-bold" style={{ color: data.primaryColor }}>
                            —
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2">
                      <button
                        className="rounded px-3 py-1 text-[10px] text-white"
                        style={{ backgroundColor: data.accentColor }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="flex gap-2 text-xs">
                {[data.primaryColor, data.secondaryColor, data.accentColor].map((c) => (
                  <div key={c} className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: c }} />
                    <span className="font-mono">{c}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
