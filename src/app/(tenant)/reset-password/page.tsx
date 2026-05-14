'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Password reset! Please sign in.')
        setDone(true)
      } else {
        toast.error(data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-xl">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Reset Password</h1>
        </div>

        <Card>
          {token ? (
            done ? (
              <CardContent className="space-y-4 pt-6 text-center">
                <p className="text-sm">Your password has been reset.</p>
                <Button asChild className="w-full">
                  <Link href="/login">Sign in</Link>
                </Button>
              </CardContent>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Choose a new password</CardTitle>
                  <CardDescription>
                    Must be at least 8 characters with uppercase and a number.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleConfirm} className="space-y-4">
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm Password</Label>
                      <Input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Reset Password
                    </Button>
                  </form>
                </CardContent>
              </>
            )
          ) : done ? (
            <CardContent className="space-y-2 pt-6 text-center">
              <p className="text-sm">
                If your email is registered, you&apos;ll receive a reset link shortly.
              </p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Forgot your password?</CardTitle>
                <CardDescription>
                  Enter your email and we&apos;ll send you a reset link.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email address</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      placeholder="you@company.com"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login">Back to sign in</Link>
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
