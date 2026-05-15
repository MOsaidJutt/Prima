import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface DataTableWidgetProps<T extends Record<string, unknown>> {
  title: string
  description?: string
  columns: Column<T>[]
  data: T[]
  className?: string
  loading?: boolean
  emptyMessage?: string
  action?: React.ReactNode
}

export function DataTableWidget<T extends Record<string, unknown>>({
  title,
  description,
  columns,
  data,
  className,
  loading,
  emptyMessage = 'No data',
  action,
}: DataTableWidgetProps<T>) {
  return (
    <div className={cn('bg-card border-border rounded-lg border shadow-sm', className)}>
      <div className="border-border flex items-start justify-between border-b p-5">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {action}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'text-muted-foreground px-4 py-2.5 text-left text-xs font-medium',
                    col.className
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-border border-b last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="bg-muted h-3.5 w-full animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground px-4 py-8 text-center text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-muted/40 border-border border-b transition-colors last:border-0"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
