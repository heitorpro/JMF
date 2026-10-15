'use client'

import dynamic from 'next/dynamic'
import type { MapPoint } from '@/lib/jmf/types'

const LeafletMap = dynamic(() => import('./map-leaflet'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-64 items-center justify-center bg-muted text-sm text-muted-foreground">
      Carregando mapa...
    </div>
  ),
})

export function JmfMap({
  points,
  height = 360,
  className,
}: {
  points: MapPoint[]
  height?: number
  className?: string
}) {
  return (
    <div className={className} style={{ height }}>
      <LeafletMap points={points} height={height} />
    </div>
  )
}
