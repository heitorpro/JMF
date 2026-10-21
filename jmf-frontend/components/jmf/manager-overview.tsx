'use client'

import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  ClipboardList,
  Clock3,
  MapPin,
  PackageCheck,
  RefreshCw,
  TrendingUp,
  Truck,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/jmf/format'
import {
  DUMPSTER_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  type ActivityItem,
  type Dumpster,
  type JmfCustomer,
  type PageKey,
  type RentalRecord,
  type RentalRequest,
} from '@/lib/jmf/types'
import { ActivityIcon, CustomerAvatar, MetricCard, PageHeader, RequestTypeIcon, SectionHeading, StatusBadge } from './ui'

const monthBars = [
  { month: 'Mai', value: 55 },
  { month: 'Jun', value: 67 },
  { month: 'Jul', value: 61 },
  { month: 'Ago', value: 76 },
  { month: 'Set', value: 86 },
  { month: 'Out', value: 72 },
]

export function ManagerOverview({
  dumpsters,
  requests,
  rentals,
  customers,
  activities,
  weeklyPrice,
  onNavigate,
  onAdvanceRequest,
  searchQuery,
}: {
  dumpsters: Dumpster[]
  requests: RentalRequest[]
  rentals: RentalRecord[]
  customers: JmfCustomer[]
  activities: ActivityItem[]
  weeklyPrice: number
  onNavigate: (page: PageKey) => void
  onAdvanceRequest: (requestId: string) => void
  searchQuery: string
}) {
  const counts = {
    total: dumpsters.length,
    free: dumpsters.filter((dumpster) => dumpster.status === 'livre').length,
    occupied: dumpsters.filter((dumpster) => dumpster.status === 'ocupada').length,
    maintenance: dumpsters.filter((dumpster) => dumpster.status === 'manutencao').length,
    unavailable: dumpsters.filter((dumpster) => dumpster.status === 'indisponivel').length,
  }
  const pending = requests.filter((request) => ['pendente', 'troca_solicitada', 'retirada_solicitada'].includes(request.status))
  const swapsPending = requests.filter((request) => request.type === 'troca' && ['troca_solicitada', 'em_troca'].includes(request.status)).length
  const removalsPending = requests.filter((request) => request.type === 'retirada' && ['retirada_solicitada', 'em_retirada'].includes(request.status)).length
  const activeRentals = rentals.filter((rental) => rental.status === 'ativo').length
  // Cada troca é um novo aluguel: conta todas as locações iniciadas no mês, inclusive as de troca.
  const monthKey = new Date().toISOString().slice(0, 7)
  const monthRentals = rentals.filter((rental) => rental.startedAt.slice(0, 7) === monthKey)
  const monthSwaps = monthRentals.filter((rental) => rental.operation === 'troca').length
  const monthRevenue = monthRentals.reduce((sum, rental) => sum + rental.weeklyPrice, 0)
  const activeRevenue = rentals.filter((rental) => rental.status === 'ativo').reduce((sum, rental) => sum + rental.weeklyPrice, 0)
  void weeklyPrice
  const lowerQuery = searchQuery.trim().toLocaleLowerCase('pt-BR')
  const visiblePending = pending
    .filter((request) => !lowerQuery || `${request.id} ${request.customerName} ${request.location.label}`.toLocaleLowerCase('pt-BR').includes(lowerQuery))
    .slice(0, 4)

  return (
    <>
      <PageHeader eyebrow="Painel de controle" title="Visão geral" description="Acompanhe a operação da JMF e mantenha as solicitações em movimento." >
        <Button variant="outline" className="gap-2" onClick={() => onNavigate('solicitacoes')}>
          <ClipboardList data-icon="inline-start" /> Ver solicitações
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Caçambas no total" value={counts.total} caption="Frota cadastrada" icon={<Boxes aria-hidden="true" className="size-5" />} accent="navy" />
        <MetricCard label="Disponíveis" value={counts.free} caption="Prontas para locação" icon={<PackageCheck aria-hidden="true" className="size-5" />} accent="green" />
        <MetricCard label="Em uso" value={counts.occupied} caption="Posicionadas com clientes" icon={<Truck aria-hidden="true" className="size-5" />} accent="blue" />
        <MetricCard label="Em manutenção" value={counts.maintenance + counts.unavailable} caption={`${counts.maintenance} manutenção · ${counts.unavailable} indisponíveis`} icon={<Clock3 aria-hidden="true" className="size-5" />} accent="amber" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => onNavigate('solicitacoes')} className="text-left">
          <MetricCard label="Solicitações pendentes" value={pending.filter((request) => request.type === 'aluguel').length} caption="Aguardando análise" icon={<ClipboardList aria-hidden="true" className="size-5" />} accent="amber" />
        </button>
        <button type="button" onClick={() => onNavigate('solicitacoes')} className="text-left">
          <MetricCard label="Trocas pendentes" value={swapsPending} caption="Cada troca gera novo aluguel" icon={<RefreshCw aria-hidden="true" className="size-5" />} accent="blue" />
        </button>
        <button type="button" onClick={() => onNavigate('solicitacoes')} className="text-left">
          <MetricCard label="Retiradas pendentes" value={removalsPending} caption="Aguardando equipe" icon={<PackageCheck aria-hidden="true" className="size-5" />} accent="amber" />
        </button>
        <button type="button" onClick={() => onNavigate('alugueis')} className="text-left">
          <MetricCard label="Aluguéis no mês" value={monthRentals.length} caption={`${formatCurrency(monthRevenue)} · ${monthSwaps} por troca · ${activeRentals} ativos`} icon={<TrendingUp aria-hidden="true" className="size-5" />} accent="green" />
        </button>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-0">
            <div>
              <CardTitle className="text-base">Resumo da operação</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Visão da frota por status neste período.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('estoque')} className="gap-1.5 text-muted-foreground">Ver estoque <ArrowRight data-icon="inline-end" /></Button>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {[
                ['Livre', 'bg-emerald-500', counts.free],
                ['Ocupada', 'bg-primary', counts.occupied],
                ['Manutenção', 'bg-amber-500', counts.maintenance],
                ['Indisponível', 'bg-slate-400', counts.unavailable],
              ].map(([label, color, count]) => (
                <span key={String(label)} className="inline-flex items-center gap-2"><span className={`size-2 rounded-full ${color}`} />{label} <span className="font-semibold text-foreground">{count}</span></span>
              ))}
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${counts.free} livres, ${counts.occupied} ocupadas, ${counts.maintenance} em manutenção e ${counts.unavailable} indisponíveis`}>
              <div className="flex h-full w-full">
                <span className="bg-emerald-500 transition-all" style={{ width: `${counts.free / counts.total * 100}%` }} />
                <span className="bg-primary transition-all" style={{ width: `${counts.occupied / counts.total * 100}%` }} />
                <span className="bg-amber-500 transition-all" style={{ width: `${counts.maintenance / counts.total * 100}%` }} />
                <span className="bg-slate-400 transition-all" style={{ width: `${counts.unavailable / counts.total * 100}%` }} />
              </div>
            </div>

            <div className="mt-8 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Locações ativas</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{activeRentals}<span className="ml-2 text-sm font-normal text-muted-foreground">caçambas</span></p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><ArrowUpRight aria-hidden="true" className="size-3.5" /> Receita das locações ativas</div>
            </div>
            <div className="mt-4 grid h-40 grid-cols-6 items-end gap-3 border-b border-border pb-2 sm:gap-5">
              {monthBars.map((bar, index) => (
                <div key={bar.month} className="flex h-full flex-col items-center justify-end gap-2">
                  <div className="relative flex w-full flex-1 items-end justify-center">
                    <div className={`w-full max-w-10 rounded-t-md transition-all ${index === monthBars.length - 1 ? 'bg-primary' : 'bg-primary/15 dark:bg-primary/25'}`} style={{ height: `${bar.value}%` }} title={`${bar.month}: ${bar.value}% de ocupação`} />
                  </div>
                  <span className={`text-[11px] ${index === monthBars.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{bar.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Ocupação da frota nos últimos 6 meses</span>
              <span className="font-semibold text-foreground">{formatCurrency(activeRevenue)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-0">
            <div>
              <CardTitle className="text-base">Solicitações para analisar</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Priorize os próximos atendimentos.</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Clock3 aria-hidden="true" className="size-4" /></span>
          </CardHeader>
          <CardContent className="pt-4">
            {visiblePending.length ? (
              <div className="flex flex-col divide-y divide-border/70">
                {visiblePending.map((request) => (
                  <div key={request.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><RequestTypeIcon type={request.type} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{request.customerName}</p><StatusBadge status={request.status} /></div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[request.type]} · {request.location.label}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">{formatDate(request.desiredDate)}</span>
                        {request.status === 'pendente' ? <Button size="xs" onClick={() => onAdvanceRequest(request.id)}>Aprovar</Button> : <Button size="xs" variant="outline" onClick={() => onNavigate('solicitacoes')}>Abrir</Button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">Não existem solicitações pendentes.</p>}
            <Button variant="ghost" onClick={() => onNavigate('solicitacoes')} className="mt-4 w-full justify-between px-2 text-muted-foreground">Ver todas as solicitações <ArrowRight data-icon="inline-end" /></Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-0">
            <div><CardTitle className="text-base">Atividade recente</CardTitle><p className="mt-1 text-sm text-muted-foreground">Últimas atualizações da operação.</p></div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('solicitacoes')}>Ver tudo</Button>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col divide-y divide-border/70">
              {activities.slice(0, 4).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <ActivityIcon kind={activity.kind} />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{activity.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{activity.description}</p></div>
                  <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-0">
            <div><CardTitle className="text-base">Clientes ativos</CardTitle><p className="mt-1 text-sm text-muted-foreground">Clientes com caçamba posicionada.</p></div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('clientes')}>Ver todos</Button>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col divide-y divide-border/70">
              {customers.filter((customer) => customer.currentDumpsterId).slice(0, 4).map((customer) => {
                const dumpster = dumpsters.find((item) => item.id === customer.currentDumpsterId)
                return (
                  <button key={customer.id} type="button" onClick={() => onNavigate('clientes')} className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0">
                    <CustomerAvatar name={customer.name} initials={customer.initials} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{customer.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{dumpster?.id ?? customer.currentDumpsterId} · {dumpster?.location?.neighborhood ?? 'Local confirmado'}</span></span>
                    <StatusBadge status="ocupada" className="shrink-0">Em uso</StatusBadge>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function ManagerQuickLinks({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { title: 'Solicitações', detail: 'Analisar novos pedidos', page: 'solicitacoes' as const, icon: ClipboardList },
        { title: 'Estoque', detail: '30 caçambas cadastradas', page: 'estoque' as const, icon: Boxes },
        { title: 'Mapa', detail: 'Ver pontos de entrega', page: 'mapa' as const, icon: MapPin },
        { title: 'Clientes', detail: 'Consultar cadastros', page: 'clientes' as const, icon: UsersRound },
      ].map((item) => (
        <button key={item.page} type="button" onClick={() => onNavigate(item.page)} className="group rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm">
          <div className="flex items-center justify-between gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/15"><item.icon aria-hidden="true" className="size-4" /></span><ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
          <p className="mt-3 text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
        </button>
      ))}
    </div>
  )
}
