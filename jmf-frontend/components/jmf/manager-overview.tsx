'use client'

import {
  ArrowRight,
  Boxes,
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
import { ManagerFinance, monthName, periodFromKey } from './manager-finance'
import { useState } from 'react'
import { fetchFinancePeriod } from '@/lib/jmf/http-service'
import { toDateInputValue } from '@/lib/jmf/format'
import type { FinancePeriodDetail, FinanceSummary } from '@/lib/jmf/types'


export function ManagerOverview({
  dumpsters,
  requests,
  rentals,
  customers,
  activities,
  weeklyPrice,
  finance,
  loadPeriod = fetchFinancePeriod,
  onOpenFleet,
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
  /** Resumo calculado no servidor; null quando o gestor não tem permissão de ver aluguéis. */
  finance?: FinanceSummary | null
  /** Busca um período do resumo financeiro (padrão: servidor). */
  loadPeriod?: (from: string, to: string) => Promise<FinancePeriodDetail>
  /** Abre a lista de caçambas já filtrada pelo status. */
  onOpenFleet?: (status: 'todas' | 'livre' | 'ocupada' | 'manutencao' | 'indisponivel') => void
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
  const activeRentals = finance?.activeRentals ?? rentals.filter((rental) => rental.status === 'ativo').length
  // Cada troca é um novo aluguel: conta todas as locações iniciadas no mês, inclusive as de troca.
  // Mês no fuso local (São Luís), nunca em UTC: evita virar o mês às 21h do último dia.
  const monthKey = (finance?.today ?? toDateInputValue()).slice(0, 7)
  const localMonthRentals = rentals.filter((rental) => rental.startedAt.slice(0, 7) === monthKey)
  const monthRentalsCount = finance ? finance.monthToDate.rentals : localMonthRentals.length
  const monthSwaps = finance ? finance.monthToDate.swaps : localMonthRentals.filter((rental) => rental.operation === 'troca').length
  const monthRevenue = finance ? finance.monthToDate.revenue : localMonthRentals.reduce((sum, rental) => sum + rental.weeklyPrice, 0)
  const occupancyMonths = finance?.months.slice(-6) ?? []
  const lastOccupancy = occupancyMonths[occupancyMonths.length - 1]
  void weeklyPrice
  // Período do resumo financeiro (mês atual por padrão); o gráfico de ocupação também escolhe o mês.
  const [periodKey, setPeriodKey] = useState(monthKey)
  const openFleet = (status: 'todas' | 'livre' | 'ocupada' | 'manutencao' | 'indisponivel') => (onOpenFleet ? onOpenFleet(status) : onNavigate('cacambas'))
  const showMonthInFinance = (month: string) => {
    setPeriodKey(month)
    document.getElementById('resumo-financeiro')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const selectedPeriod = periodFromKey(periodKey)
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
        <button type="button" onClick={() => openFleet('todas')} className="text-left" aria-label="Ver todas as caçambas">
          <MetricCard label="Caçambas no total" value={counts.total} caption="Frota cadastrada" icon={<Boxes aria-hidden="true" className="size-5" />} accent="navy" />
        </button>
        <button type="button" onClick={() => openFleet('livre')} className="text-left" aria-label="Ver caçambas disponíveis">
          <MetricCard label="Disponíveis" value={counts.free} caption="Prontas para locação" icon={<PackageCheck aria-hidden="true" className="size-5" />} accent="green" />
        </button>
        <button type="button" onClick={() => openFleet('ocupada')} className="text-left" aria-label="Ver caçambas em uso">
          <MetricCard label="Em uso" value={counts.occupied} caption="Posicionadas com clientes" icon={<Truck aria-hidden="true" className="size-5" />} accent="blue" />
        </button>
        <button type="button" onClick={() => openFleet('manutencao')} className="text-left" aria-label="Ver caçambas em manutenção">
          <MetricCard label="Em manutenção" value={counts.maintenance + counts.unavailable} caption={`${counts.maintenance} manutenção · ${counts.unavailable} indisponíveis`} icon={<Clock3 aria-hidden="true" className="size-5" />} accent="amber" />
        </button>
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
        <button type="button" onClick={() => showMonthInFinance(monthKey)} className="text-left" aria-label="Ver o mês atual no resumo financeiro">
          <MetricCard label={`Aluguéis em ${monthName(monthKey)}`} value={monthRentalsCount} caption={`${formatCurrency(monthRevenue)} · ${monthSwaps} por troca · ${activeRentals} ativos`} icon={<TrendingUp aria-hidden="true" className="size-5" />} accent="green" />
        </button>
      </div>

      {finance ? <ManagerFinance finance={finance} periodKey={periodKey} onPeriodChange={setPeriodKey} loadPeriod={loadPeriod} onNavigate={onNavigate} /> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-0">
            <div>
              <CardTitle className="text-base">Resumo da operação</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Situação da frota agora. Clique num status para ver as caçambas.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('estoque')} className="gap-1.5 text-muted-foreground">Ver estoque <ArrowRight data-icon="inline-end" /></Button>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {([
                ['Livre', 'bg-emerald-500', counts.free, 'livre'],
                ['Ocupada', 'bg-primary', counts.occupied, 'ocupada'],
                ['Manutenção', 'bg-amber-500', counts.maintenance, 'manutencao'],
                ['Indisponível', 'bg-slate-400', counts.unavailable, 'indisponivel'],
              ] as const).map(([label, color, count, status]) => (
                <button key={label} type="button" onClick={() => openFleet(status)} className="inline-flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted hover:text-foreground" aria-label={`Ver caçambas: ${label} (${count})`}><span className={`size-2 rounded-full ${color}`} />{label} <span className="font-semibold text-foreground">{count}</span></button>
              ))}
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted" aria-label={`${counts.free} livres, ${counts.occupied} ocupadas, ${counts.maintenance} em manutenção e ${counts.unavailable} indisponíveis`}>
              <div className="flex h-full w-full gap-0.5">
                {([
                  ['bg-emerald-500', counts.free, 'livre', 'Livres'],
                  ['bg-primary', counts.occupied, 'ocupada', 'Ocupadas'],
                  ['bg-amber-500', counts.maintenance, 'manutencao', 'Em manutenção'],
                  ['bg-slate-400', counts.unavailable, 'indisponivel', 'Indisponíveis'],
                ] as const).filter(([, count]) => count > 0).map(([color, count, status, label]) => (
                  <button key={status} type="button" onClick={() => openFleet(status)} title={`${label}: ${count}`} aria-label={`Ver caçambas: ${label} (${count})`} className={`${color} h-full transition-opacity hover:opacity-80`} style={{ width: `${count / Math.max(counts.total, 1) * 100}%` }} />
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-end justify-between gap-3">
              <button type="button" onClick={() => onNavigate('alugueis')} className="rounded-lg text-left transition-colors hover:text-primary" aria-label="Ver aluguéis ativos">
                <span className="block text-xs font-medium text-muted-foreground">Locações ativas</span>
                <span className="mt-1 block text-2xl font-semibold tracking-tight">{activeRentals}<span className="ml-2 text-sm font-normal text-muted-foreground">caçambas · ver aluguéis →</span></span>
              </button>
              {lastOccupancy ? (
                <p className="text-right text-xs text-muted-foreground">Ocupação média em {monthName(lastOccupancy.month)}<span className="block text-base font-semibold text-foreground tabular-nums">{lastOccupancy.occupancyPct.toLocaleString('pt-BR')}%</span></p>
              ) : null}
            </div>
            {occupancyMonths.length ? (
              <>
                <div className="mt-4 grid h-40 items-end gap-3 border-b border-border pb-2 sm:gap-5" style={{ gridTemplateColumns: `repeat(${occupancyMonths.length}, minmax(0, 1fr))` }}>
                  {occupancyMonths.map((bar, index) => {
                    const last = index === occupancyMonths.length - 1
                    const active = selectedPeriod.kind === 'mes' ? bar.month === periodKey : bar.month >= selectedPeriod.from.slice(0, 7) && bar.month <= selectedPeriod.to.slice(0, 7)
                    const label = `${monthName(bar.month)} de ${bar.month.slice(0, 4)}${last ? ' (parcial)' : ''}: ocupação média de ${bar.occupancyPct.toLocaleString('pt-BR')}% da frota. Clique para ver este mês no resumo financeiro.`
                    return (
                      <button type="button" key={bar.month} onClick={() => showMonthInFinance(bar.month)} className="group flex h-full cursor-pointer flex-col items-center justify-end gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-pressed={active} aria-label={label} title={label}>
                        <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 tabular-nums">{Math.round(bar.occupancyPct)}%</span>
                        <div className="relative flex w-full flex-1 items-end justify-center">
                          <div className={`w-full max-w-10 rounded-t-[4px] transition-all ${active ? 'bg-primary' : 'bg-primary/25 group-hover:bg-primary/45 dark:bg-primary/35'}`} style={{ height: `${Math.max(bar.occupancyPct, bar.occupancyPct > 0 ? 3 : 0)}%` }} />
                        </div>
                        <span className={`text-[11px] ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{monthName(bar.month, 'short').replace(/^./, (c) => c.toUpperCase())}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Ocupação média da frota nos últimos 6 meses (dias com caçamba no cliente ÷ dias de frota). Clique num mês para abri-lo no resumo financeiro.</p>
              </>
            ) : null}
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
