'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Widget {
  id: string
  colSpan?: 1 | 2 | 3 | 4
  children: React.ReactNode
}

interface DashboardGridProps {
  dashboardKey: string // unique key per dashboard for preference storage
  widgets: Widget[]
  className?: string
}

function SortableWidget({
  id,
  colSpan = 1,
  children,
  onHide,
}: Widget & { onHide: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const colClass =
    colSpan === 2
      ? 'md:col-span-2'
      : colSpan === 3
        ? 'md:col-span-3'
        : colSpan === 4
          ? 'md:col-span-4'
          : 'md:col-span-1'

  return (
    <div ref={setNodeRef} style={style} className={cn('group relative col-span-1', colClass)}>
      {/* Drag handle + hide button — visible on hover */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          {...attributes}
          {...listeners}
          className="bg-background/80 hover:bg-muted cursor-grab rounded p-1 backdrop-blur-sm active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onHide(id)}
          className="bg-background/80 hover:bg-muted rounded p-1 backdrop-blur-sm"
          title="Hide widget"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  )
}

function saveLayout(key: string, order: string[], hidden: string[]) {
  fetch('/api/me/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [`dash_${key}_order`]: order, [`dash_${key}_hidden`]: hidden }),
  }).catch(() => {})
}

export function DashboardGrid({ dashboardKey, widgets, className }: DashboardGridProps) {
  const [order, setOrder] = useState<string[]>(() => widgets.map((w) => w.id))
  const [hidden, setHidden] = useState<string[]>([])
  const [initialized, setInitialized] = useState(false)

  // Load saved preferences on mount
  useEffect(() => {
    fetch('/api/me/preferences')
      .then((r) => r.json())
      .then((prefs: Record<string, unknown>) => {
        const savedOrder = prefs[`dash_${dashboardKey}_order`]
        const savedHidden = prefs[`dash_${dashboardKey}_hidden`]
        if (Array.isArray(savedOrder)) setOrder(savedOrder)
        if (Array.isArray(savedHidden)) setHidden(savedHidden)
      })
      .catch(() => {})
      .finally(() => setInitialized(true))
  }, [dashboardKey])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        setOrder((prev) => {
          const oldIdx = prev.indexOf(String(active.id))
          const newIdx = prev.indexOf(String(over.id))
          const newOrder = arrayMove(prev, oldIdx, newIdx)
          saveLayout(dashboardKey, newOrder, hidden)
          return newOrder
        })
      }
    },
    [dashboardKey, hidden]
  )

  const hideWidget = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const next = [...prev, id]
        saveLayout(dashboardKey, order, next)
        toast.success('Widget hidden — restore it from dashboard settings')
        return next
      })
    },
    [dashboardKey, order]
  )

  const restoreAll = useCallback(() => {
    setHidden([])
    saveLayout(dashboardKey, order, [])
    toast.success('All widgets restored')
  }, [dashboardKey, order])

  // Sort widgets by saved order, then append any new ones not in saved order
  const sortedWidgets = [
    ...(order.map((id) => widgets.find((w) => w.id === id)).filter(Boolean) as Widget[]),
    ...widgets.filter((w) => !order.includes(w.id)),
  ].filter((w) => !hidden.includes(w.id))

  if (!initialized) {
    return (
      <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-4', className)}>
        {widgets.slice(0, 4).map((w) => (
          <div
            key={w.id}
            className="bg-muted animate-pulse rounded-lg"
            style={{ minHeight: 120 }}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {hidden.length > 0 && (
        <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
          <span>{hidden.length} widget(s) hidden.</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={restoreAll}>
            Restore all
          </Button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedWidgets.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-4', className)}>
            {sortedWidgets.map((widget) => (
              <SortableWidget key={widget.id} {...widget} onHide={hideWidget} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
