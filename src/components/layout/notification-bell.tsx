'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=8')
      if (!res.ok) return
      const data = await res.json()
      if (data.success) {
        setNotifications(data.data)
        setUnread(data.unreadCount ?? 0)
      }
    } catch {
      // Non-critical — bell stays at 0
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (cancelled) return
      await fetchNotifications()
    }

    load()
    const interval = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [fetchNotifications])

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnread(0)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="text-muted-foreground p-4 text-center text-sm">No notifications</div>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <div className={`flex flex-col gap-0.5 px-3 py-2 ${!n.isRead ? 'bg-muted/40' : ''}`}>
                <span className="text-sm leading-tight font-medium">{n.title}</span>
                <span className="text-muted-foreground line-clamp-1 text-xs">{n.body}</span>
                <span className="text-muted-foreground text-[10px]">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/notifications" className="justify-center text-center text-xs">
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
