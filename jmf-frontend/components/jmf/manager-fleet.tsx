'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Boxes,
  Check,
  MapPin,
  PackageCheck,
  Search,
  Settings2,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate } from '@/lib/jmf/format'
import {
  DUMPSTER_STATUS_LABELS,
  formatDumpsterNumber,
  type Dumpster,
  type DumpsterStatus,
  type PageKey,
} from '@/lib/jmf/types'
import { MetricCard, PageHeader, StatusBadge } from './ui'

const fleetFilters = [
  { id: 'todas', label: 'Todas' },
  { id: 'livre', label: 'Livres' },
  { id: 'ocupada', label: 'Ocupadas' },
  { id: 'manutencao', label: 'Manutenção' },
  { id: 'indisponivel', label: 'Indisponíveis' },
] as const

type FleetFilter = (typeof fleetFilters)[number]['id']

export function ManagerDumpstersPage({
  dumpsters,
  searchQuery,
  onChangeStatus,
  onNavigate,
  busyIds = new Set<string>(),
}: {
  dumpsters: Dumpster[]
  searchQuery: string
  busyIds?: Set<string>
  onChangeStatus: (dumpsterId: string, status: DumpsterStatus) => void
  onNavigate: (page: PageKey) => void
}) {
  const [filter, setFilter] = useState<FleetFilter>('todas')
  const [localQuery, setLocalQuery] = useState('')
  const query = `${searchQuery} ${localQuery}`.trim().toLocaleLowerCase('pt-BR')
  const filtered = useMemo(() => dumpsters
    .filter((dumpster) => filter === 'todas' || dumpster.status === filter)
    .filter((dumpster) => !query || `${dumpster.id} ${dumpster.customerName ?? ''} ${dumpster.location?.label ?? ''}`.toLocaleLowerCase('pt-BR').includes(query))
    .sort((a, b) => a.number - b.number), [dumpsters, filter, query])
  const counts = {
    livre: dumpsters.filter((dumpster) => dumpster.status === 'livre').length,
    ocupada: dumpsters.filter((dumpster) => dumpster.status === 'ocupada').length,
    manutencao: dumpsters.filter((dumpster) => dumpster.status === 'manutencao').length,
    indisponivel: dumpsters.filter((dumpster) => dumpster.status === 'indisponivel').length,
  }

  return (
    <>
      <PageHeader eyebrow="Gestão de frota" title="Caçambas" description="Acompanhe cada unidade da frota e atualize a disponibilidade para locação." >
        <Button variant="outline" onClick={() => onNavigate('estoque')} className="gap-2"><Boxes data-icon="inline-start" /> Ver estoque</Button>
        <Button variant="outline" onClick={() => onNavigate('mapa')} className="gap-2"><MapPin data-icon="inline-start" /> Abrir mapa</Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Estoque físico" value={dumpsters.length} caption="Unidades identificadas" icon={<Boxes aria-hidden="true" className="size-5" />} accent="navy" />
        <MetricCard label="Livres" value={counts.livre} caption="Disponíveis para locação" icon={<PackageCheck aria-hidden="true" className="size-5" />} accent="green" />
        <MetricCard label="Ocupadas" value={counts.ocupada} caption="Posicionadas com clientes" icon={<Truck aria-hidden="true" className="size-5" />} accent="blue" />
        <MetricCard label="Fora de operação" value={counts.manutencao + counts.indisponivel} caption={`${counts.manutencao} manutenção · ${counts.indisponivel} indisponíveis`} icon={<Settings2 aria-hidden="true" className="size-5" />} accent="amber" />
      </div>

      <Card className="mt-5 border-border/70 shadow-none">
        <CardHeader className="pb-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><CardTitle className="text-base">Frota JMF</CardTitle><p className="mt-1 text-sm text-muted-foreground">Identificação individual das 30 caçambas cadastradas.</p></div>
            <div className="relative w-full lg:max-w-xs">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar caçamba" value={localQuery} onChange={(event) => setLocalQuery(event.target.value)} placeholder="Buscar número ou cliente" className="h-9 pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as FleetFilter)} className="gap-0">
            <TabsList variant="line" className="mb-4 w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
              {fleetFilters.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className="min-w-fit rounded-none px-3 py-2.5 text-xs sm:text-sm">
                  {item.label}<span className="ml-1 text-[10px] text-muted-foreground">{item.id === 'todas' ? dumpsters.length : counts[item.id]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filtered.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((dumpster) => (
                <article key={dumpster.id} className="rounded-xl border border-border/80 bg-background p-4 transition-colors hover:border-primary/25">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-lg font-semibold tracking-tight">{formatDumpsterNumber(dumpster.number)}</p><p className="mt-1 text-xs text-muted-foreground">Caçamba padrão</p></div>
                    <StatusBadge status={dumpster.status} />
                  </div>
                  {dumpster.status === 'ocupada' ? (
                    <div className="mt-4 border-t border-border/70 pt-3">
                      <p className="text-xs text-muted-foreground">Cliente atual</p><p className="mt-1 truncate text-sm font-medium">{dumpster.customerName}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin aria-hidden="true" className="size-3.5" />{dumpster.location?.label ?? 'Local não informado'}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">Desde {dumpster.rentalStartedAt ? formatDate(dumpster.rentalStartedAt) : '—'}</p>
                    </div>
                  ) : (
                    <div className="mt-4 flex min-h-20 items-center justify-between gap-3 border-t border-border/70 pt-3">
                      <div className="min-w-0"><p className="text-xs text-muted-foreground">{dumpster.status === 'livre' ? 'Pronta para uma nova locação' : dumpster.status === 'manutencao' ? 'Indisponível durante revisão' : 'Fora de operação'}</p>{dumpster.notes ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{dumpster.notes}</p> : null}</div>
                      <Select value={dumpster.status} disabled={busyIds.has(dumpster.id)} onValueChange={(value) => onChangeStatus(dumpster.id, value as DumpsterStatus)}>
                        <SelectTrigger aria-label={`Atualizar status da caçamba ${dumpster.id}`} className="h-8 w-9 shrink-0 justify-center px-1.5"><Settings2 aria-hidden="true" className="size-4" /></SelectTrigger>
                        <SelectContent align="end">
                          <SelectGroup>
                            {(['livre', 'manutencao', 'indisponivel'] as DumpsterStatus[]).map((status) => <SelectItem key={status} value={status}>{DUMPSTER_STATUS_LABELS[status]}</SelectItem>)}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : <div className="rounded-xl border border-dashed border-border"><p className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhuma caçamba encontrada com esse filtro.</p></div>}
        </CardContent>
      </Card>
    </>
  )
}

export function ManagerStockPage({
  dumpsters,
  onNavigate,
}: {
  dumpsters: Dumpster[]
  onNavigate: (page: PageKey) => void
}) {
  const countByStatus = {
    livre: dumpsters.filter((dumpster) => dumpster.status === 'livre').length,
    ocupada: dumpsters.filter((dumpster) => dumpster.status === 'ocupada').length,
    manutencao: dumpsters.filter((dumpster) => dumpster.status === 'manutencao').length,
    indisponivel: dumpsters.filter((dumpster) => dumpster.status === 'indisponivel').length,
  }
  const total = dumpsters.length || 1
  const statuses: { id: DumpsterStatus; color: string; textColor: string }[] = [
    { id: 'livre', color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-300' },
    { id: 'ocupada', color: 'bg-primary', textColor: 'text-primary' },
    { id: 'manutencao', color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-300' },
    { id: 'indisponivel', color: 'bg-slate-400', textColor: 'text-slate-600 dark:text-slate-300' },
  ]

  return (
    <>
      <PageHeader eyebrow="Gestão de frota" title="Estoque" description="Visão consolidada da disponibilidade e distribuição da frota." >
        <Button variant="outline" onClick={() => onNavigate('cacambas')} className="gap-2"><Truck data-icon="inline-start" /> Gerenciar caçambas</Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total físico" value={dumpsters.length} caption="Frota cadastrada" icon={<Boxes aria-hidden="true" className="size-5" />} accent="navy" />
        <MetricCard label="Disponíveis" value={countByStatus.livre} caption="Liberadas para locação" icon={<PackageCheck aria-hidden="true" className="size-5" />} accent="green" />
        <MetricCard label="Ocupadas" value={countByStatus.ocupada} caption="Em atendimento" icon={<Truck aria-hidden="true" className="size-5" />} accent="blue" />
        <MetricCard label="Em manutenção" value={countByStatus.manutencao} caption={`${countByStatus.indisponivel} indisponíveis`} icon={<Settings2 aria-hidden="true" className="size-5" />} accent="amber" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card className="border-border/70 shadow-none">
          <CardHeader><CardTitle className="text-base">Distribuição do estoque</CardTitle><p className="mt-1 text-sm text-muted-foreground">Status atualizado para cada unidade da frota.</p></CardHeader>
          <CardContent>
            <div className="flex h-4 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${countByStatus.livre} livres, ${countByStatus.ocupada} ocupadas, ${countByStatus.manutencao} em manutenção e ${countByStatus.indisponivel} indisponíveis`}>
              {statuses.map((status) => <span key={status.id} className={`${status.color} transition-all`} style={{ width: `${countByStatus[status.id] / total * 100}%` }} />)}
            </div>
            <div className="mt-6 flex flex-col gap-4">
              {statuses.map((status) => (
                <div key={status.id} className="flex items-center gap-3">
                  <span className={`size-2.5 rounded-full ${status.color}`} />
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">{DUMPSTER_STATUS_LABELS[status.id]}</span>
                  <span className="w-10 text-right text-sm font-semibold text-foreground">{countByStatus[status.id]}</span>
                  <span className={`w-12 text-right text-xs font-medium ${status.textColor}`}>{Math.round(countByStatus[status.id] / total * 100)}%</span>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => onNavigate('cacambas')} className="mt-6 w-full justify-between">Ver unidades da frota <ArrowRight data-icon="inline-end" /></Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardHeader><CardTitle className="text-base">Disponibilidade agora</CardTitle><p className="mt-1 text-sm text-muted-foreground">Caçambas prontas para o próximo pedido.</p></CardHeader>
          <CardContent>
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-primary-foreground/75">Livres para locação</p><p className="mt-2 text-4xl font-semibold tracking-tight">{countByStatus.livre}<span className="ml-2 text-base font-medium text-primary-foreground/70">unidades</span></p></div><span className="flex size-10 items-center justify-center rounded-xl bg-white/10"><Check aria-hidden="true" className="size-5" /></span></div>
              <p className="mt-4 text-xs leading-5 text-primary-foreground/70">O sistema impede novas solicitações quando não houver unidades disponíveis.</p>
            </div>
            <div className="mt-5 flex items-center justify-between text-sm"><span className="text-muted-foreground">Capacidade total</span><span className="font-semibold">{dumpsters.length} caçambas</span></div>
            <div className="mt-3 flex items-center justify-between text-sm"><span className="text-muted-foreground">Em atendimento</span><span className="font-semibold">{countByStatus.ocupada} clientes</span></div>
            <div className="mt-3 flex items-center justify-between text-sm"><span className="text-muted-foreground">Fora de operação</span><span className="font-semibold">{countByStatus.manutencao + countByStatus.indisponivel} unidades</span></div>
            <Button variant="ghost" onClick={() => onNavigate('mapa')} className="mt-5 w-full justify-between text-muted-foreground">Ver posições no mapa <MapPin data-icon="inline-end" /></Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
