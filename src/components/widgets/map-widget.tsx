'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

// Leaflet cannot run server-side — dynamic import with ssr: false
const LeafletMap = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <MapSkeleton />,
})

function MapSkeleton() {
  return <div className="bg-muted h-[280px] w-full animate-pulse rounded-md" />
}

export interface MapPoint {
  lat: number
  lng: number
  label: string
  value?: string
  color?: string
}

interface MapWidgetProps {
  title: string
  description?: string
  points: MapPoint[]
  className?: string
  loading?: boolean
  height?: number
}

export function MapWidget({
  title,
  description,
  points,
  className,
  loading,
  height = 280,
}: MapWidgetProps) {
  return (
    <div className={cn('bg-card border-border rounded-lg border p-5 shadow-sm', className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      {loading ? <MapSkeleton /> : <LeafletMap points={points} height={height} />}
    </div>
  )
}
