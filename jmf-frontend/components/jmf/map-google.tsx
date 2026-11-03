'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react'
import { formatDate } from '@/lib/jmf/format'
import { GOOGLE_MAPS_MAP_ID, importGoogleLibrary, onGoogleMapsFailure } from '@/lib/jmf/google-maps'
import { DUMPSTER_STATUS_LABELS, type MapPoint } from '@/lib/jmf/types'
import type { JmfMapProps } from './map'

const SAO_LUIS = { lat: -2.5297, lng: -44.3028 }

function markerElement(status: MapPoint['status']) {
  const el = document.createElement('div')
  el.className = `jmf-map-marker jmf-map-marker--${status}`
  el.style.width = '28px'
  el.style.height = '28px'
  const dot = document.createElement('span')
  dot.className = 'jmf-map-marker__dot'
  el.appendChild(dot)
  return el
}

/** Conteúdo do balão montado com textContent (sem HTML vindo dos dados). */
function popupElement(point: MapPoint) {
  const root = document.createElement('div')
  root.style.cssText = 'min-width:190px;font-family:inherit;color:#0f172a;padding:2px'
  const line = (text: string, style: string) => {
    const p = document.createElement('p')
    p.textContent = text
    p.style.cssText = `margin:0;${style}`
    root.appendChild(p)
  }
  line(`Caçamba ${point.id} · ${DUMPSTER_STATUS_LABELS[point.status]}`, 'font-weight:600;font-size:13px')
  line(point.location.label, 'font-size:12px;color:#64748b;margin-top:2px')
  if (point.customerName) line(`Cliente: ${point.customerName}`, 'font-size:12px;margin-top:8px')
  if (point.requestId) line(`Solicitação: ${point.requestId}`, 'font-size:12px;margin-top:2px')
  if (point.rentalStartedAt) line(`Início: ${formatDate(point.rentalStartedAt)}`, 'font-size:12px;margin-top:2px')
  line(`${point.location.street}, ${point.location.number} · ${point.location.city}/${point.location.state}`, 'font-size:11px;color:#64748b;margin-top:6px')
  return root
}

function positionOf(marker: any) {
  const pos = marker.position
  return { lat: typeof pos.lat === 'function' ? pos.lat() : pos.lat, lng: typeof pos.lng === 'function' ? pos.lng() : pos.lng }
}

export default function MapGoogle({
  points,
  height,
  onPick,
  defaultCenter,
  zoomable,
  focusId,
  onFail,
}: JmfMapProps & { height: number; onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const infoRef = useRef<any>(null)
  const markersRef = useRef(new Map<string, any>())
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const editable = Boolean(onPick)
  const [ready, setReady] = useState(false)
  const lastIdsRef = useRef('')
  const lastFirstRef = useRef('')

  // Cria o mapa uma vez.
  useEffect(() => {
    let cancelled = false
    const unsubscribe = onGoogleMapsFailure(onFail)
    ;(async () => {
      try {
        const { Map, InfoWindow } = await importGoogleLibrary('maps')
        await importGoogleLibrary('marker')
        if (cancelled || !containerRef.current) return
        const first = points[0]?.location
        const center = first
          ? { lat: first.latitude, lng: first.longitude }
          : defaultCenter ? { lat: defaultCenter.latitude, lng: defaultCenter.longitude } : SAO_LUIS
        const map = new Map(containerRef.current, {
          center,
          zoom: points.length === 1 ? 16 : 12,
          mapId: GOOGLE_MAPS_MAP_ID,
          // "greedy": a roda do mouse / um dedo já dão zoom e movem o mapa (painel do gestor).
          // "cooperative": dentro do formulário, a página continua rolando normalmente.
          gestureHandling: zoomable ? 'greedy' : 'cooperative',
          zoomControl: true,
          mapTypeControl: Boolean(zoomable),
          streetViewControl: false,
          fullscreenControl: Boolean(zoomable),
          clickableIcons: false,
        })
        if (editable) {
          map.addListener('click', (event: any) => onPickRef.current?.(event.latLng.lat(), event.latLng.lng()))
        }
        mapRef.current = map
        infoRef.current = new InfoWindow()
        setReady(true)
      } catch {
        if (!cancelled) onFail()
      }
    })()
    return () => {
      cancelled = true
      unsubscribe()
      markersRef.current.forEach((marker) => { marker.map = null })
      markersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sincroniza os marcadores sem recriar o mapa (o zoom do usuário é mantido).
  useEffect(() => {
    const map = mapRef.current
    const google = (window as any).google
    if (!ready || !map || !google) return
    const { AdvancedMarkerElement } = google.maps.marker
    const seen = new Set<string>()
    for (const point of points) {
      seen.add(point.id)
      const position = { lat: point.location.latitude, lng: point.location.longitude }
      let marker = markersRef.current.get(point.id)
      if (!marker) {
        marker = new AdvancedMarkerElement({ map, position, title: point.id, content: markerElement(point.status), gmpDraggable: editable })
        if (editable) {
          marker.addListener('dragend', () => {
            const { lat, lng } = positionOf(marker)
            onPickRef.current?.(lat, lng)
          })
        } else {
          marker.addListener('click', () => {
            const current = (marker as any).__point as MapPoint
            infoRef.current?.setContent(popupElement(current))
            infoRef.current?.open({ anchor: marker, map })
          })
        }
        markersRef.current.set(point.id, marker)
      } else {
        marker.position = position
        marker.content = markerElement(point.status)
      }
      ;(marker as any).__point = point
    }
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.map = null
        markersRef.current.delete(id)
      }
    })

    // Câmera: no formulário, acompanha o ponto; nos demais, enquadra todos quando o conjunto muda.
    if (editable) {
      const first = points[0]?.location
      const key = first ? `${first.latitude},${first.longitude}` : ''
      if (first && key !== lastFirstRef.current) {
        map.panTo({ lat: first.latitude, lng: first.longitude })
        if (map.getZoom() < 16) map.setZoom(16)
      }
      lastFirstRef.current = key
      return
    }
    const ids = points.map((point) => point.id).sort().join('|')
    if (ids !== lastIdsRef.current && !focusId) {
      lastIdsRef.current = ids
      if (points.length === 1) {
        map.setCenter({ lat: points[0].location.latitude, lng: points[0].location.longitude })
        map.setZoom(16)
      } else if (points.length > 1) {
        const bounds = new google.maps.LatLngBounds()
        points.forEach((point) => bounds.extend({ lat: point.location.latitude, lng: point.location.longitude }))
        map.fitBounds(bounds, 48)
      }
    }
  }, [editable, focusId, points, ready])

  // Foco numa caçamba escolhida na lista (gestor).
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || editable) return
    if (!focusId) {
      lastIdsRef.current = '' // "Ver todas": reenquadra no próximo ciclo
      infoRef.current?.close()
      const google = (window as any).google
      if (points.length > 1 && google) {
        const bounds = new google.maps.LatLngBounds()
        points.forEach((point) => bounds.extend({ lat: point.location.latitude, lng: point.location.longitude }))
        map.fitBounds(bounds, 48)
        lastIdsRef.current = points.map((point) => point.id).sort().join('|')
      }
      return
    }
    const marker = markersRef.current.get(focusId)
    if (!marker) return
    map.panTo(positionOf(marker))
    map.setZoom(Math.max(map.getZoom(), 17))
    infoRef.current?.setContent(popupElement((marker as any).__point))
    infoRef.current?.open({ anchor: marker, map })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, ready])

  return <div ref={containerRef} style={{ height, width: '100%' }} className="jmf-leaflet-map" aria-label="Mapa de localização" />
}
