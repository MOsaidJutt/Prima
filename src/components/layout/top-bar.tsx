'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun, LogOut, User, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { superAdminLogout, tenantLogout } from '@/lib/auth/actions'
import { NotificationBell } from '@/components/layout/notification-bell'
import Link from 'next/link'

type TopBarProps = {
  variant: 'super_admin' | 'tenant_admin' | 'manager' | 'sales_rep'
  userName?: string
  userEmail?: string
  userAvatar?: string | null
}

export function TopBar({ variant, userName, userEmail, userAvatar }: TopBarProps) {
  const { setTheme, theme } = useTheme()
  const isTenant = variant !== 'super_admin'

  const handleLogout = () => {
    if (variant === 'super_admin') superAdminLogout()
    else tenantLogout()
  }

  const initials = userName
    ? userName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U'

  return (
    <header className="bg-card flex h-16 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>

        {/* Notification bell — tenant only */}
        {isTenant && <NotificationBell />}

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Account menu"
              className="h-9 w-9 rounded-full"
            >
              <Avatar className="h-8 w-8">
                {userAvatar && <AvatarImage src={userAvatar} alt={userName ?? 'User'} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{userName ?? 'User'}</p>
              <p className="text-muted-foreground text-xs">{userEmail ?? ''}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isTenant && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/admin/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings/organization">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
