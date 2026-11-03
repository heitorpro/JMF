'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { googleMapsEnabled } from '@/lib/jmf/google-maps'
import type { MapPoint } from '@/lib/jmf/types'

export interface JmfMapProps {
  points: MapPoint[]
  /** Modo de escolha: tocar no mapa ou arrastar o marcador define o ponto. */
  onPick?: (latitude: number, longitude: number) => void
  defaultCenter?: { latitude: number; longitude: number }
  /** Zoom livre pela roda do mouse/gestos e controles completos (mapa do gestor). */
  zoomable?: boolean
  /** Caçamba em destaque: o mapa aproxima e abre o balão dela. null = enquadrar todas. */
  focusId?: string | null
}

const loading = () => (
  <div className="flex h-full min-h-64 items-center justify-center bg-muted text-sm text-muted-foreground">
    Carregando mapa...
  </div>
)

const LeafletMap = dynamic(() => import('./map-leaflet'), { ssr: false, loading })
const GoogleMap = dynamic(() => import('./map-google'), { ssr: false, loading })

/** Google Maps quando há chave configurada; OpenStreetMap como reserva. */
export function JmfMap({
  height = 360,
  className,
  ...props
}: JmfMapProps & { height?: number; className?: string }) {
  const [googleFailed, setGoogleFailed] = useState(false)
  const useGoogle = googleMapsEnabled() && !googleFailed
  return (
    <div className={className} style={{ height }}>
      {useGoogle
        ? <GoogleMap {...props} height={height} onFail={() => setGoogleFailed(true)} />
        : <LeafletMap {...props} height={height} />}
    </div>
  )
}
