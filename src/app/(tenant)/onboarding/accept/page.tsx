'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ShieldCheck } from 'lucide-react'

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  )
}

function AcceptInviteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      toast.error('Invalid invitation link. Please ask your admin to resend the invite.')
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return

    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Something went wrong')
        return
      }
      toast.success('Password set! Setting up your workspace...')
      router.push(data.redirect ?? '/onboarding')
    } catch {
      toast.error('Something went wrong. Please try again.')
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
              This invitation link is missing a token. Please use the link from your invitation
              email, or ask your admin to send a new invite.
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
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to Prima</h1>
          <p className="text-muted-foreground text-sm">Set a password to activate your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your password</CardTitle>
            <CardDescription>
              Must be at least 8 characters with one uppercase letter and one number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <PasswordInput
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set Password & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
