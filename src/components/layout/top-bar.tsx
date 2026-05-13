'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { superAdminLogout, tenantLogout } from '@/lib/auth/actions'

type TopBarProps = {
  variant: 'super_admin' | 'tenant_admin' | 'manager' | 'sales_rep'
  userName?: string
  userEmail?: string
}

export function TopBar({ variant, userName, userEmail }: TopBarProps) {
  const { setTheme, theme } = useTheme()

  const handleLogout = () => {
    if (variant === 'super_admin') superAdminLogout()
    else tenantLogout()
  }

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

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{userName ?? 'User'}</p>
              <p className="text-muted-foreground text-xs">{userEmail ?? ''}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
