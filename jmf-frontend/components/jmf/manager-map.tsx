'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, LocateFixed, MapPin, Maximize2, PackageCheck, Truck, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate } from '@/lib/jmf/format'
import {
  DUMPSTER_STATUS_LABELS,
  type Dumpster,
  type DumpsterStatus,
  type MapPoint,
} from '@/lib/jmf/types'
import { EmptyState, PageHeader, StatusBadge } from './ui'
import { JmfMap } from './map'

const mapFilters = [
  { id: 'todas', label: 'Todas' },
  { id: 'livre', label: 'Livres' },
  { id: 'ocupada', label: 'Ocupadas' },
  { id: 'manutencao', label: 'Manutenção' },
  { id: 'indisponivel', label: 'Indisponíveis' },
] as const

type MapFilter = (typeof mapFilters)[number]['id']

export function ManagerMapPage({ dumpsters }: { dumpsters: Dumpster[] }) {
  const [filter, setFilter] = useState<MapFilter>('todas')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Caçamba em foco no mapa (aproxima e abre o balão); null = enquadrar todas. */
  const [focusId, setFocusId] = useState<string | null>(null)
  const points: MapPoint[] = useMemo(() => dumpsters
    .filter((dumpster) => dumpster.location)
    .map((dumpster) => ({
      id: dumpster.id,
      status: dumpster.status,
      customerName: dumpster.customerName,
      location: dumpster.location!,
      rentalStartedAt: dumpster.rentalStartedAt,
    })), [dumpsters])
  const visiblePoints = points.filter((point) => filter === 'todas' || point.status === filter)
  const selectedPoint = visiblePoints.find((point) => point.id === selectedId) ?? visiblePoints[0]

  return (
    <>
      <PageHeader eyebrow="Gestão de frota" title="Mapa das caçambas" description="Localize as unidades posicionadas e consulte cliente, status e início do aluguel." >
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><LocateFixed aria-hidden="true" className="size-4 text-primary" />{visiblePoints.length} pontos no mapa</div>
      </PageHeader>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="text-base">Localização operacional</CardTitle><p className="mt-1 text-sm text-muted-foreground">Use a roda do mouse ou os botões + e − para dar zoom. Clique numa caçamba da lista para aproximar.</p></div>
            <Tabs value={filter} onValueChange={(value) => { setFilter(value as MapFilter); setFocusId(null) }}>
              <TabsList className="flex w-full overflow-x-auto sm:w-auto">
                {mapFilters.map((item) => <TabsTrigger key={item.id} value={item.id} className="px-2.5 text-xs">{item.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative overflow-hidden rounded-xl border border-border/70">
              {visiblePoints.length ? (
                <JmfMap points={visiblePoints} height={560} className="w-full" zoomable focusId={visiblePoints.some((point) => point.id === focusId) ? focusId : null} />
              ) : (
                <div className="flex h-[540px] items-center justify-center bg-muted/40">
                  <EmptyState title="Sem pontos para exibir" description="As localizações aparecem aqui depois que uma caçamba é posicionada." />
                </div>
              )}
              {visiblePoints.length > 1 ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => setFocusId(null)} className="absolute top-3 left-1/2 z-[1000] h-9 -translate-x-1/2 gap-1.5 shadow-md"><Maximize2 data-icon="inline-start" />Ver todas</Button>
              ) : null}
              <div className="absolute bottom-4 left-4 z-[1000] flex flex-wrap gap-2 rounded-xl border border-border/70 bg-background/95 p-2.5 shadow-md backdrop-blur">
                {[
                  ['livre', 'bg-emerald-500'],
                  ['ocupada', 'bg-primary'],
                  ['manutencao', 'bg-amber-500'],
                  ['indisponivel', 'bg-slate-400'],
                ].map(([status, color]) => <span key={status} className="inline-flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground"><span className={`size-2 rounded-full ${color}`} />{DUMPSTER_STATUS_LABELS[status as DumpsterStatus]}</span>)}
              </div>
            </div>

            <aside className="flex min-h-0 flex-col rounded-xl border border-border/70 bg-card">
              <div className="border-b border-border/70 px-4 py-3.5"><h2 className="text-sm font-semibold">Unidades localizadas</h2><p className="mt-1 text-xs text-muted-foreground">{visiblePoints.length} caçambas com endereço.</p></div>
              <div className="max-h-[350px] overflow-y-auto p-2 xl:max-h-[480px]">
                {visiblePoints.length ? visiblePoints.map((point) => (
                  <button key={point.id} type="button" onClick={() => { setSelectedId(point.id); setFocusId(point.id) }} className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${selectedPoint?.id === point.id ? 'bg-primary/6 dark:bg-primary/10' : 'hover:bg-muted/60'}`}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><MapPin aria-hidden="true" className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{point.id}</span><StatusBadge status={point.status} className="shrink-0" /></span><span className="mt-1 block truncate text-xs text-muted-foreground">{point.location.label}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{point.customerName ?? 'Sem cliente associado'}</span></span>
                  </button>
                )) : <p className="px-3 py-8 text-center text-xs text-muted-foreground">Nenhuma caçamba nesse filtro possui endereço.</p>}
              </div>
              {selectedPoint ? (
                <div className="mt-auto border-t border-border/70 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">Caçamba selecionada</p><p className="mt-1 text-lg font-semibold">{selectedPoint.id}</p></div><StatusBadge status={selectedPoint.status} /></div>
                  <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{selectedPoint.location.street}, {selectedPoint.location.number} · {selectedPoint.location.label}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Truck aria-hidden="true" className="size-3.5" />{selectedPoint.customerName ?? 'Sem cliente associado'}</p>
                  {selectedPoint.rentalStartedAt ? <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><PackageCheck aria-hidden="true" className="size-3.5" />Aluguel desde {formatDate(selectedPoint.rentalStartedAt)}</p> : null}
                  <Button type="button" variant="outline" onClick={() => setFocusId(selectedPoint.id)} className="mt-4 h-9 w-full gap-2"><ZoomIn data-icon="inline-start" />Aproximar no mapa</Button>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${selectedPoint.location.latitude},${selectedPoint.location.longitude}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                    Abrir no Google Maps <ArrowUpRight aria-hidden="true" className="size-4" />
                  </a>
                </div>
              ) : null}
            </aside>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
