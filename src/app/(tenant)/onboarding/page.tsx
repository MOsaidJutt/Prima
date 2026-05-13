'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Building2, Palette, FolderOpen, UserPlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    id: 1,
    label: 'Organization Profile',
    icon: Building2,
    description: 'Tell us about your company',
  },
  { id: 2, label: 'Branding', icon: Palette, description: 'Make Prima yours' },
  { id: 3, label: 'First Department', icon: FolderOpen, description: 'Set up your first team' },
  { id: 4, label: 'Invite Team', icon: UserPlus, description: 'Bring your team aboard' },
]

type StepData = {
  // Step 1
  name: string
  phone: string
  city: string
  country: string
  ntn: string
  strn: string
  // Step 2
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  // Step 3
  departmentName: string
  // Step 4
  inviteEmails: string
}

const DEFAULT: StepData = {
  name: '',
  phone: '',
  city: '',
  country: 'PK',
  ntn: '',
  strn: '',
  primaryColor: '#6366F1',
  secondaryColor: '#8B5CF6',
  fontFamily: 'Inter',
  departmentName: '',
  inviteEmails: '',
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<StepData>(DEFAULT)
  const [loading, setLoading] = useState(false)

  function set(field: keyof StepData, value: string) {
    setData((d) => ({ ...d, [field]: value }))
  }

  async function handleComplete() {
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to complete onboarding')
      toast.success('Onboarding complete! Welcome to Prima.')
      router.push('/admin')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="bg-primary text-primary-foreground mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold">
            P
          </div>
          <h1 className="text-2xl font-bold">Welcome to Prima</h1>
          <p className="text-muted-foreground">Let&apos;s set up your workspace in 4 quick steps</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              <button
                onClick={() => step > s.id && setStep(s.id)}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                  step > s.id
                    ? 'border-primary bg-primary text-primary-foreground cursor-pointer'
                    : step === s.id
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                )}
              >
                {step > s.id ? <CheckCircle className="h-4 w-4" /> : s.id}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn('mx-2 h-0.5 flex-1', step > s.id ? 'bg-primary' : 'bg-border')}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const S = STEPS[step - 1]
                return (
                  <>
                    <S.icon className="text-primary h-5 w-5" />
                    {S.label}
                  </>
                )
              })()}
            </CardTitle>
            <CardDescription>{STEPS[step - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input
                      value={data.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder="ACME Pakistan (Pvt) Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={data.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      placeholder="+92-21-1234567"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={data.city}
                      onChange={(e) => set('city', e.target.value)}
                      placeholder="Karachi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      value={data.country}
                      onChange={(e) => set('country', e.target.value)}
                      placeholder="PK"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>NTN</Label>
                    <Input
                      value={data.ntn}
                      onChange={(e) => set('ntn', e.target.value)}
                      placeholder="1234567-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>STRN</Label>
                    <Input
                      value={data.strn}
                      onChange={(e) => set('strn', e.target.value)}
                      placeholder="12-34-5678-001-24"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-muted-foreground text-sm">
                  Choose your brand colors. These will appear across your entire workspace.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={data.primaryColor}
                        onChange={(e) => set('primaryColor', e.target.value)}
                        className="border-input h-9 w-12 cursor-pointer rounded border"
                      />
                      <Input
                        value={data.primaryColor}
                        onChange={(e) => set('primaryColor', e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={data.secondaryColor}
                        onChange={(e) => set('secondaryColor', e.target.value)}
                        className="border-input h-9 w-12 cursor-pointer rounded border"
                      />
                      <Input
                        value={data.secondaryColor}
                        onChange={(e) => set('secondaryColor', e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <select
                    value={data.fontFamily}
                    onChange={(e) => set('fontFamily', e.target.value)}
                    className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                  >
                    {[
                      'Inter',
                      'Roboto',
                      'Open Sans',
                      'Lato',
                      'Poppins',
                      'Nunito',
                      'Montserrat',
                      'Raleway',
                    ].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Live preview */}
                <div className="rounded-lg border p-4" style={{ fontFamily: data.fontFamily }}>
                  <div className="mb-3 flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded"
                      style={{ backgroundColor: data.primaryColor }}
                    />
                    <span className="font-semibold">Preview</span>
                  </div>
                  <div
                    className="mb-2 h-2 w-3/4 rounded-full"
                    style={{ backgroundColor: data.primaryColor, opacity: 0.3 }}
                  />
                  <div
                    className="h-2 w-1/2 rounded-full"
                    style={{ backgroundColor: data.secondaryColor, opacity: 0.3 }}
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-2">
                <Label>Department Name *</Label>
                <Input
                  value={data.departmentName}
                  onChange={(e) => set('departmentName', e.target.value)}
                  placeholder="Sales"
                />
                <p className="text-muted-foreground text-xs">
                  You can add more departments after setup from Settings → Departments.
                </p>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-2">
                <Label>Invite Team Members</Label>
                <textarea
                  value={data.inviteEmails}
                  onChange={(e) => set('inviteEmails', e.target.value)}
                  placeholder="john@company.com&#10;jane@company.com&#10;sales@company.com"
                  rows={5}
                  className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                />
                <p className="text-muted-foreground text-xs">
                  Enter one email per line. You can also skip this and invite later.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
            Back
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !data.name}>
              Next Step
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Setup
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
