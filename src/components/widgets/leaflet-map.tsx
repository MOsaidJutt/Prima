'use client'

import { useEffect, useRef } from 'react'
import type { MapPoint } from './map-widget'

interface LeafletMapProps {
  points: MapPoint[]
  height: number
}

export default function LeafletMap({ points, height }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return

      // Fix marker icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const center: [number, number] =
        points.length > 0
          ? [
              points.reduce((s, p) => s + p.lat, 0) / points.length,
              points.reduce((s, p) => s + p.lng, 0) / points.length,
            ]
          : [30.3753, 69.3451] // Pakistan center

      const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: false }).setView(
        center,
        points.length > 0 ? 6 : 5
      )

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      points.forEach((pt) => {
        const marker = L.marker([pt.lat, pt.lng]).addTo(map)
        if (pt.label) {
          marker.bindPopup(`<strong>${pt.label}</strong>${pt.value ? `<br/>${pt.value}` : ''}`)
        }
      })

      mapInstanceRef.current = map
    })

    return () => {
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapInstanceRef.current as any).remove()
        mapInstanceRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div ref={mapRef} style={{ height }} className="z-0 w-full rounded-md" />
    </>
  )
}
