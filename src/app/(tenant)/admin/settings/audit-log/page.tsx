'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type LogEntry = {
  id: string
  action: string
  entity: string
  entityId: string | null
  oldValue: unknown
  newValue: unknown
  createdAt: string
  user: { id: string; name: string; email: string } | null
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-success/10 text-success',
  UPDATE: 'bg-info/10 text-info',
  DELETE: 'bg-destructive/10 text-destructive',
  SUSPEND: 'bg-warning/10 text-warning',
  INVITE: 'bg-primary/10 text-primary',
  BRANDING_CHANGE: 'bg-accent/10 text-accent',
  PASSWORD_RESET: 'bg-muted text-muted-foreground',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (entity) params.set('entity', entity)
    if (action) params.set('action', action)
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    const res = await fetch(`/api/audit-log?${params}`)
    const data = await res.json()
    if (data.success) {
      setLogs(data.data)
      setTotal(data.total)
    }
    setLoading(false)
  }, [page, entity, action, from, to])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground text-sm">{total} total entries</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          value={entity}
          onValueChange={(v) => {
            setEntity(v === 'all' ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {['User', 'Role', 'Department', 'Organization', 'InvoiceTemplate'].map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v === 'all' ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {[
              'CREATE',
              'UPDATE',
              'DELETE',
              'SUSPEND',
              'INVITE',
              'BRANDING_CHANGE',
              'PASSWORD_RESET',
            ].map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
          className="w-36"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
          className="w-36"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                      No log entries
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <>
                      <TableRow
                        key={log.id}
                        className="cursor-pointer"
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      >
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.user ? (
                            <span>{log.user.name}</span>
                          ) : (
                            <span className="text-muted-foreground">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`font-mono text-xs ${ACTION_COLORS[log.action] ?? 'bg-muted text-muted-foreground'}`}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-medium">{log.entity}</span>
                          {log.entityId && (
                            <span className="text-muted-foreground ml-1 font-mono text-xs">
                              …{log.entityId.slice(-6)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {log.newValue ? 'View diff ▾' : '—'}
                        </TableCell>
                      </TableRow>
                      {expanded === log.id && (log.oldValue || log.newValue) && (
                        <TableRow key={`${log.id}-detail`}>
                          <TableCell colSpan={5} className="bg-muted/30 p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              {!!log.oldValue && (
                                <div>
                                  <p className="text-destructive mb-1 text-xs font-semibold">
                                    Before
                                  </p>
                                  <pre className="bg-destructive/5 overflow-auto rounded p-2 font-mono text-xs">
                                    {JSON.stringify(log.oldValue as object, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {!!log.newValue && (
                                <div>
                                  <p className="text-success mb-1 text-xs font-semibold">After</p>
                                  <pre className="bg-success/5 overflow-auto rounded p-2 font-mono text-xs">
                                    {JSON.stringify(log.newValue as object, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
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
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
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
