'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { RotateCcw } from 'lucide-react'
import * as SelectPrimitive from '@radix-ui/react-select'

export interface FilterBarProps {
  departments?: { id: string; name: string }[]
  users?: { id: string; name: string }[]
  categories?: { id: string; name: string }[]
  showDateRange?: boolean
  showDepartment?: boolean
  showUser?: boolean
  showCategory?: boolean
  className?: string
}

export function FilterBar({
  departments = [],
  users = [],
  categories = [],
  showDateRange = true,
  showDepartment = false,
  showUser = false,
  showCategory = false,
  className,
}: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`)
      })
    },
    [searchParams, pathname, router]
  )

  const reset = useCallback(() => {
    startTransition(() => {
      router.replace(pathname)
    })
  }, [router, pathname])

  const hasFilters =
    searchParams.get('from') ||
    searchParams.get('to') ||
    searchParams.get('dept') ||
    searchParams.get('user') ||
    searchParams.get('category')

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
      {showDateRange && (
        <>
          <div className="flex items-center gap-1">
            <label className="text-muted-foreground text-xs">From</label>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={searchParams.get('from') ?? ''}
              onChange={(e) => updateParam('from', e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-muted-foreground text-xs">To</label>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={searchParams.get('to') ?? ''}
              onChange={(e) => updateParam('to', e.target.value)}
            />
          </div>
        </>
      )}

      {showDepartment && departments.length > 0 && (
        <SelectPrimitive.Root
          value={searchParams.get('dept') ?? ''}
          onValueChange={(v) => updateParam('dept', v === 'all' ? '' : v)}
        >
          <SelectPrimitive.Trigger className="border-input bg-background flex h-8 items-center gap-1 rounded-md border px-2.5 text-sm focus:outline-none">
            <SelectPrimitive.Value placeholder="All Departments" />
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content className="bg-popover border-border z-50 rounded-md border shadow-md">
              <SelectPrimitive.Viewport className="p-1">
                <SelectPrimitive.Item
                  value="all"
                  className="hover:bg-accent cursor-pointer rounded px-3 py-1.5 text-sm outline-none"
                >
                  <SelectPrimitive.ItemText>All Departments</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
                {departments.map((d) => (
                  <SelectPrimitive.Item
                    key={d.id}
                    value={d.id}
                    className="hover:bg-accent cursor-pointer rounded px-3 py-1.5 text-sm outline-none"
                  >
                    <SelectPrimitive.ItemText>{d.name}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      )}

      {showUser && users.length > 0 && (
        <SelectPrimitive.Root
          value={searchParams.get('user') ?? ''}
          onValueChange={(v) => updateParam('user', v === 'all' ? '' : v)}
        >
          <SelectPrimitive.Trigger className="border-input bg-background flex h-8 items-center gap-1 rounded-md border px-2.5 text-sm focus:outline-none">
            <SelectPrimitive.Value placeholder="All Users" />
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content className="bg-popover border-border z-50 rounded-md border shadow-md">
              <SelectPrimitive.Viewport className="p-1">
                <SelectPrimitive.Item
                  value="all"
                  className="hover:bg-accent cursor-pointer rounded px-3 py-1.5 text-sm outline-none"
                >
                  <SelectPrimitive.ItemText>All Users</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
                {users.map((u) => (
                  <SelectPrimitive.Item
                    key={u.id}
                    value={u.id}
                    className="hover:bg-accent cursor-pointer rounded px-3 py-1.5 text-sm outline-none"
                  >
                    <SelectPrimitive.ItemText>{u.name}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      )}

      {showCategory && categories.length > 0 && (
        <SelectPrimitive.Root
          value={searchParams.get('category') ?? ''}
          onValueChange={(v) => updateParam('category', v === 'all' ? '' : v)}
        >
          <SelectPrimitive.Trigger className="border-input bg-background flex h-8 items-center gap-1 rounded-md border px-2.5 text-sm focus:outline-none">
            <SelectPrimitive.Value placeholder="All Categories" />
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content className="bg-popover border-border z-50 rounded-md border shadow-md">
              <SelectPrimitive.Viewport className="p-1">
                <SelectPrimitive.Item
                  value="all"
                  className="hover:bg-accent cursor-pointer rounded px-3 py-1.5 text-sm outline-none"
                >
                  <SelectPrimitive.ItemText>All Categories</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
                {categories.map((c) => (
                  <SelectPrimitive.Item
                    key={c.id}
                    value={c.id}
                    className="hover:bg-accent cursor-pointer rounded px-3 py-1.5 text-sm outline-none"
                  >
                    <SelectPrimitive.ItemText>{c.name}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
          onClick={reset}
          disabled={isPending}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      )}

      {isPending && <span className="text-muted-foreground ml-1 text-xs">Loading…</span>}
    </div>
  )
}
