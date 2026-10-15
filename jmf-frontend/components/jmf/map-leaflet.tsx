'use client'

import { useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import type { MapPoint } from '@/lib/jmf/types'
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

export default function MapLeaflet({
  points,
  height,
}: {
  points: MapPoint[]
  height: number
}) {
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
    : [-2.5297, -44.3028]
  const mapKey = points
    .map((point) => `${point.id}:${point.location.latitude}:${point.location.longitude}`)
    .join('|')

  return (
    <MapContainer
      key={mapKey}
      center={center}
      zoom={points.length > 1 ? 11 : 14}
      scrollWheelZoom={false}
      zoomControl={false}
      style={{ height, width: '100%' }}
      className="jmf-leaflet-map"
      aria-label="Mapa de localização das caçambas"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.location.latitude, point.location.longitude]}
          icon={icons[point.status]}
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
