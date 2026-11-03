'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { MapPoint } from '@/lib/jmf/types'
import type { JmfMapProps } from './map'
import { DUMPSTER_STATUS_LABELS } from '@/lib/jmf/types'
import { formatDate } from '@/lib/jmf/format'

function createIcon(status: MapPoint['status']) {
  return L.divIcon({
    className: `jmf-map-marker jmf-map-marker--${status}`,
    html: '<span class="jmf-map-marker__dot"></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

/** Mantém o mapa centralizado no ponto sem recriá-lo (atualização suave enquanto o cliente digita). */
function FollowPoint({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), zoom), { animate: true })
  }, [center[0], center[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Enquadra todos os pontos quando o conjunto muda (sem desfazer o zoom do usuário a cada atualização). */
function FitPoints({ points, focusId }: { points: MapPoint[]; focusId?: string | null }) {
  const map = useMap()
  const ids = points.map((point) => point.id).sort().join('|')
  useEffect(() => {
    if (focusId || !points.length) return
    if (points.length === 1) {
      map.setView([points[0].location.latitude, points[0].location.longitude], 16)
      return
    }
    map.fitBounds(L.latLngBounds(points.map((point) => [point.location.latitude, point.location.longitude] as [number, number])), { padding: [40, 40] })
  }, [ids, focusId]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Aproxima a caçamba escolhida na lista e abre o balão dela. */
function FocusPoint({ points, focusId, markers }: { points: MapPoint[]; focusId?: string | null; markers: React.RefObject<Map<string, L.Marker>> }) {
  const map = useMap()
  useEffect(() => {
    if (!focusId) return
    const point = points.find((item) => item.id === focusId)
    if (!point) return
    map.flyTo([point.location.latitude, point.location.longitude], Math.max(map.getZoom(), 17), { duration: 0.6 })
    markers.current?.get(focusId)?.openPopup()
  }, [focusId]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function PickOnClick({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) })
  return null
}

export default function MapLeaflet({
  points,
  height,
  onPick,
  defaultCenter,
  zoomable,
  focusId,
}: JmfMapProps & { height: number }) {
  const markers = useRef(new Map<string, L.Marker>())
  const icons = useMemo(
    () => ({
      livre: createIcon('livre'),
      ocupada: createIcon('ocupada'),
      manutencao: createIcon('manutencao'),
      indisponivel: createIcon('indisponivel'),
    }),
    [],
  )
  const firstPoint = points[0]
  const center: [number, number] = firstPoint
    ? [firstPoint.location.latitude, firstPoint.location.longitude]
    : defaultCenter ? [defaultCenter.latitude, defaultCenter.longitude] : [-2.5297, -44.3028]
  const editable = Boolean(onPick)
  const mapKey = editable ? 'editable' : zoomable ? 'zoomable' : points
    .map((point) => `${point.id}:${point.location.latitude}:${point.location.longitude}`)
    .join('|')

  return (
    <MapContainer
      key={mapKey}
      center={center}
      zoom={editable && !points.length ? 12 : points.length > 1 ? 11 : 16}
      scrollWheelZoom={Boolean(zoomable)}
      zoomControl={Boolean(zoomable || editable)}
      style={{ height, width: '100%' }}
      className="jmf-leaflet-map"
      aria-label="Mapa de localização das caçambas"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {editable ? <PickOnClick onPick={onPick!} /> : null}
      {zoomable ? <FitPoints points={points} focusId={focusId} /> : null}
      {zoomable ? <FocusPoint points={points} focusId={focusId} markers={markers} /> : null}
      {editable && firstPoint ? <FollowPoint center={center} zoom={16} /> : null}
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.location.latitude, point.location.longitude]}
          icon={icons[point.status]}
          ref={(marker) => {
            if (marker) markers.current.set(point.id, marker)
            else markers.current.delete(point.id)
          }}
          draggable={editable}
          eventHandlers={editable ? {
            dragend: (event) => {
              const { lat, lng } = (event.target as L.Marker).getLatLng()
              onPick!(lat, lng)
            },
          } : undefined}
          title={point.id}
          alt={`Marcador ${point.id}`}
        >
          <Popup>
            <div className="min-w-48 p-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Caçamba {point.id}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{point.location.label}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                  {DUMPSTER_STATUS_LABELS[point.status]}
                </span>
              </div>
              {point.customerName ? (
                <p className="mt-3 text-xs text-slate-600">
                  Cliente: <span className="font-medium text-slate-900">{point.customerName}</span>
                </p>
              ) : null}
              {point.requestId ? (
                <p className="mt-1 text-xs text-slate-600">
                  Solicitação: <span className="font-medium text-slate-900">{point.requestId}</span>
                </p>
              ) : null}
              {point.rentalStartedAt ? (
                <p className="mt-1 text-xs text-slate-600">
                  Início: <span className="font-medium text-slate-900">{formatDate(point.rentalStartedAt)}</span>
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-slate-500">
                {point.location.street}, {point.location.number} · {point.location.city}/{point.location.state}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
