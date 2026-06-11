'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, UserCheck } from 'lucide-react'

export default function AcceptUserInvitePage() {
  return (
    <Suspense>
      <AcceptUserInviteForm />
    </Suspense>
  )
}

function AcceptUserInviteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [form, setForm] = useState({ name: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) toast.error('Invalid invitation link.')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: form.name, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Something went wrong')
        return
      }
      toast.success('Account activated! Welcome to Prima.')
      router.push(data.redirect ?? '/admin')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Link</CardTitle>
            <CardDescription>
              This invitation link is missing a token. Ask your admin to resend the invite.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-xl">
            <UserCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Accept Invitation</h1>
          <p className="text-muted-foreground text-sm">Set up your account to join your team</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Enter your name and choose a strong password to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <PasswordInput
                  id="confirm"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate Account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
