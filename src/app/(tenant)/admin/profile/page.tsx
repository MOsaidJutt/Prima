'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Loader2, Shield } from 'lucide-react'

type ProfileData = {
  id: string
  name: string
  email: string
  phone: string | null
  avatar: string | null
  isMfaEnabled: boolean
  lastLoginAt: string | null
  preferences: {
    theme?: 'light' | 'dark' | 'system'
    emailNotifications?: boolean
    inAppNotifications?: boolean
  }
  role: { id: string; name: string }
  department: { id: string; name: string } | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [prefs, setPrefs] = useState({
    theme: 'system' as 'light' | 'dark' | 'system',
    emailNotifications: true,
    inAppNotifications: true,
  })
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' })

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setProfile(d.data)
          setForm({ name: d.data.name, phone: d.data.phone ?? '' })
          setPrefs({
            theme: d.data.preferences.theme ?? 'system',
            emailNotifications: d.data.preferences.emailNotifications ?? true,
            inAppNotifications: d.data.preferences.inAppNotifications ?? true,
          })
        }
        setLoading(false)
      })
  }, [])

  async function handleSaveProfile() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, phone: form.phone || null, preferences: prefs }),
      })
      const data = await res.json()
      if (data.success) toast.success('Profile saved')
      else toast.error(data.error)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwdForm.next !== pwdForm.confirm) {
      toast.error('New passwords do not match')
      return
    }
    setSavingPwd(true)
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwdForm.current, newPassword: pwdForm.next }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Password changed')
        setPwdForm({ current: '', next: '', confirm: '' })
      } else {
        toast.error(data.error)
      }
    } finally {
      setSavingPwd(false)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  if (!profile) return null

  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your account and preferences</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Avatar + role card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-20 w-20">
                {profile.avatar && <AvatarImage src={profile.avatar} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-semibold">{profile.name}</p>
                <p className="text-muted-foreground text-sm">{profile.email}</p>
                <Badge variant="outline" className="mt-2">
                  {profile.role.name}
                </Badge>
              </div>
              {profile.department && (
                <p className="text-muted-foreground text-sm">{profile.department.name}</p>
              )}
              {profile.lastLoginAt && (
                <p className="text-muted-foreground text-xs">
                  Last login: {new Date(profile.lastLoginAt).toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {/* Personal info */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+92..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email address</Label>
                <Input value={profile.email} disabled className="opacity-60" />
                <p className="text-muted-foreground text-xs">
                  Email cannot be changed. Contact your admin.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-muted-foreground text-xs">Your display preference</p>
                </div>
                <Select
                  value={prefs.theme}
                  onValueChange={(v) => setPrefs({ ...prefs, theme: v as typeof prefs.theme })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-muted-foreground text-xs">Receive updates via email</p>
                </div>
                <Switch
                  checked={prefs.emailNotifications}
                  onCheckedChange={(v) => setPrefs({ ...prefs, emailNotifications: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">In-App Notifications</p>
                  <p className="text-muted-foreground text-xs">Show notification bell alerts</p>
                </div>
                <Switch
                  checked={prefs.inAppNotifications}
                  onCheckedChange={(v) => setPrefs({ ...prefs, inAppNotifications: v })}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Profile
          </Button>

          {/* Change password */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Use a strong password with uppercase letters and numbers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current">Current Password</Label>
                  <PasswordInput
                    id="current"
                    value={pwdForm.current}
                    onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="next">New Password</Label>
                  <PasswordInput
                    id="next"
                    value={pwdForm.next}
                    onChange={(e) => setPwdForm({ ...pwdForm, next: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm New Password</Label>
                  <PasswordInput
                    id="confirm"
                    value={pwdForm.confirm}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={savingPwd}>
                  {savingPwd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* MFA stub */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>Add an extra layer of security to your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-muted-foreground text-sm">
                  TOTP-based MFA is coming in Phase 7.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
