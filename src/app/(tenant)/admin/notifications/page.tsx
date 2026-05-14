'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

const TYPE_ICON: Record<string, string> = {
  user_invited: '👤',
  role_changed: '🛡️',
  department_assigned: '📂',
  system: 'ℹ️',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  async function fetchNotifications(p = 1) {
    setLoading(true)
    const res = await fetch(`/api/notifications?page=${p}&limit=20`)
    const data = await res.json()
    if (data.success) {
      setNotifications(data.data)
      setTotal(data.total)
      setUnread(data.unreadCount)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void fetchNotifications()
  }, [])

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnread(0)
    toast.success('All notifications marked as read')
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnread((u) => Math.max(0, u - 1))
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unread > 0 && <p className="text-muted-foreground text-sm">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-3 py-12">
              <Bell className="h-10 w-10 opacity-30" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-4 p-4 transition-colors ${!n.isRead ? 'bg-muted/40' : ''}`}
                  onClick={() => !n.isRead && markRead(n.id)}
                >
                  <span className="mt-0.5 text-xl">{TYPE_ICON[n.type] ?? '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-tight font-medium">{n.title}</p>
                      {!n.isRead && <Badge className="shrink-0 text-[10px]">New</Badge>}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-sm">{n.body}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-sm">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => {
                    setPage(page - 1)
                    fetchNotifications(page - 1)
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => {
                    setPage(page + 1)
                    fetchNotifications(page + 1)
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
