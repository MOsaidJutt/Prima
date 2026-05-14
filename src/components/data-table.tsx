'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronUp, ChevronDown, ChevronsUpDown, Columns, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

export type ColumnDef<T> = {
  key: string
  label: string
  sortable?: boolean
  hidden?: boolean
  render?: (row: T) => React.ReactNode
  exportValue?: (row: T) => string | number
}

type SortDir = 'asc' | 'desc' | null

interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  selectable?: boolean
  onSelectionChange?: (ids: string[]) => void
  bulkActions?: Array<{ label: string; onClick: (ids: string[]) => void; destructive?: boolean }>
  exportFilename?: string
  emptyMessage?: string
  className?: string
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  selectable,
  onSelectionChange,
  bulkActions,
  exportFilename = 'export',
  emptyMessage = 'No records found.',
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(
    new Set(columns.filter((c) => c.hidden).map((c) => c.key))
  )

  const visibleCols = columns.filter((c) => !hiddenCols.has(c.key))

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data
    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey]
      const bVal = (b as Record<string, unknown>)[sortKey]
      const cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  function handleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
      return
    }
    if (sortDir === 'asc') {
      setSortDir('desc')
      return
    }
    setSortKey(null)
    setSortDir(null)
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      onSelectionChange?.([...next])
      return next
    })
  }

  function toggleAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set())
      onSelectionChange?.([])
    } else {
      const all = new Set(sorted.map((r) => r.id))
      setSelected(all)
      onSelectionChange?.([...all])
    }
  }

  function handleExport() {
    const rows = sorted.map((row) =>
      Object.fromEntries(
        columns.map((col) => [
          col.label,
          col.exportValue
            ? col.exportValue(row)
            : String((row as Record<string, unknown>)[col.key] ?? ''),
        ])
      )
    )
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, `${exportFilename}.xlsx`)
  }

  function SortIcon({ col }: { col: ColumnDef<T> }) {
    if (!col.sortable) return null
    if (sortKey !== col.key) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40" />
    if (sortDir === 'asc') return <ChevronUp className="ml-1 h-3 w-3" />
    return <ChevronDown className="ml-1 h-3 w-3" />
  }

  const allSelected = sorted.length > 0 && selected.size === sorted.length
  const someSelected = selected.size > 0 && !allSelected

  return (
    <div className={cn('space-y-2', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {selectable && selected.size > 0 && bulkActions && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{selected.size} selected</span>
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.destructive ? 'destructive' : 'outline'}
                onClick={() => action.onClick([...selected])}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {columns.map((col) => (
                <DropdownMenuItem
                  key={col.key}
                  className="flex items-center gap-2"
                  onSelect={(e) => {
                    e.preventDefault()
                    setHiddenCols((prev) => {
                      const next = new Set(prev)
                      prev.has(col.key) ? next.delete(col.key) : next.add(col.key)
                      return next
                    })
                  }}
                >
                  <span
                    className={`h-4 w-4 rounded border ${hiddenCols.has(col.key) ? 'border-muted-foreground' : 'bg-primary border-primary'}`}
                  />
                  {col.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {visibleCols.map((col) => (
                <TableHead
                  key={col.key}
                  className={col.sortable ? 'cursor-pointer select-none' : ''}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center">
                    {col.label}
                    <SortIcon col={col} />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {selectable && <TableCell />}
                  {visibleCols.map((col) => (
                    <TableCell key={col.key}>
                      <div className="bg-muted h-4 animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleCols.length + (selectable ? 1 : 0)}
                  className="text-muted-foreground py-12 text-center text-sm"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(selected.has(row.id) && 'bg-muted/40')}
                  data-state={selected.has(row.id) ? 'selected' : undefined}
                >
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggleRow(row.id)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  )}
                  {visibleCols.map((col) => (
                    <TableCell key={col.key}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ── Pagination helper ─────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground text-sm">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
          const p = i + 1
          return (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(p)}
              className="w-8 px-0"
            >
              {p}
            </Button>
          )
        })}
        {totalPages > 5 && page < totalPages && (
          <span className="text-muted-foreground text-sm">…</span>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

// ── Server-side search helper ─────────────────────────────────────────────────

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-3"
      />
    </div>
  )
}
