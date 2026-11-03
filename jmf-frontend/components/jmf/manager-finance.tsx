'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarClock, LoaderCircle, MapPin, Minus, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/jmf/format'
import type { FinanceDue, FinanceMonth, FinancePeriodDetail, FinanceSummary, PageKey } from '@/lib/jmf/types'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------ datas (sempre a partir do "hoje" do servidor)

function monthDate(ym: string) {
  return new Date(`${ym}-01T12:00:00`)
}

export function monthName(ym: string, style: 'long' | 'short' = 'long') {
  return new Intl.DateTimeFormat('pt-BR', { month: style }).format(monthDate(ym)).replace('.', '')
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function lastDay(year: number, month: number) {
  return new Date(year, month, 0).getDate() // month 1–12
}

function shortDay(date: string) {
  return formatDate(date, { year: undefined })
}

function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

function dueText(item: FinanceDue) {
  if (item.daysLate > 1) return `venceu há ${item.daysLate} dias`
  if (item.daysLate === 1) return 'venceu ontem'
  if (item.daysLate === 0) return 'vence hoje'
  if (item.daysLate === -1) return 'vence amanhã'
  return `vence em ${-item.daysLate} dias`
}

// ------------------------------------------------------------------ períodos

export type PeriodKind = 'mes' | 'semestre' | 'ano'

export interface FinancePeriodOption {
  /** "2026-11" · "2026-S2" · "2026" */
  key: string
  kind: PeriodKind
  label: string
  from: string
  to: string
}

export function periodFromKey(key: string): FinancePeriodOption {
  const year = Number(key.slice(0, 4))
  if (/^\d{4}-\d{2}$/.test(key)) {
    const month = Number(key.slice(5, 7))
    return { key, kind: 'mes', label: `${capitalize(monthName(key))} de ${year}`, from: `${key}-01`, to: `${key}-${pad(lastDay(year, month))}` }
  }
  if (/^\d{4}-S[12]$/.test(key)) {
    const first = key.endsWith('1')
    return {
      key, kind: 'semestre', label: `${first ? '1º' : '2º'} semestre de ${year}`,
      from: `${year}-${first ? '01' : '07'}-01`, to: `${year}-${first ? '06-30' : '12-31'}`,
    }
  }
  return { key, kind: 'ano', label: `Ano de ${year}`, from: `${year}-01-01`, to: `${year}-12-31` }
}

function periodOptions(today: string) {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const months: FinancePeriodOption[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(year, month - 1 - i, 1)
    months.push(periodFromKey(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`))
  }
  const semester = month <= 6 ? 1 : 2
  const semesters = [0, 1, 2].map((back) => {
    const index = (year * 2 + semester - 1) - back
    return periodFromKey(`${Math.floor(index / 2)}-S${(index % 2) + 1}`)
  })
  const years = [year, year - 1].map((y) => periodFromKey(String(y)))
  return { months, semesters, years }
}

/** Nome do período anterior usado na comparação. */
function previousLabel(kind: PeriodKind, detail: FinancePeriodDetail) {
  const from = detail.previous.from
  const same = detail.partial ? ` (mesmo período: ${shortDay(detail.previous.from)} a ${shortDay(detail.previous.to)})` : ''
  if (kind === 'mes') return `${monthName(from.slice(0, 7))}${same}`
  if (kind === 'semestre') return `${Number(from.slice(5, 7)) === 1 ? '1º' : '2º'} semestre de ${from.slice(0, 4)}${same}`
  return `${from.slice(0, 4)}${same}`
}

// ------------------------------------------------------------------ componente

export function ManagerFinance({
  finance,
  periodKey,
  onPeriodChange,
  loadPeriod,
  onNavigate,
}: {
  finance: FinanceSummary
  periodKey: string
  onPeriodChange: (key: string) => void
  loadPeriod: (from: string, to: string) => Promise<FinancePeriodDetail>
  onNavigate: (page: PageKey) => void
}) {
  const [range, setRange] = useState<6 | 12>(6)
  const [view, setView] = useState<'grafico' | 'tabela'>('grafico')
  const [detail, setDetail] = useState<FinancePeriodDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const run = useRef(0)

  const period = periodFromKey(periodKey)
  const options = useMemo(() => periodOptions(finance.today), [finance.today])
  const currentMonthKey = finance.today.slice(0, 7)
  const currentSemesterKey = `${finance.today.slice(0, 4)}-S${Number(finance.today.slice(5, 7)) <= 6 ? 1 : 2}`
  const previousMonthKey = options.months[1].key

  // Busca o período escolhido; atualiza também quando os dados do painel mudam.
  useEffect(() => {
    const id = ++run.current
    setLoading(true)
    setFailed(false)
    loadPeriod(period.from, period.to)
      .then((result) => { if (id === run.current) setDetail(result) })
      .catch(() => { if (id === run.current) setFailed(true) })
      .finally(() => { if (id === run.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, finance])

  const chartMonths = period.kind === 'mes' ? finance.months.slice(-range) : (detail?.months ?? [])
  const selectedMonths = new Set(period.kind === 'mes' ? [period.key] : chartMonths.map((m) => m.month))

  return (
    <Card id="resumo-financeiro" className="mt-5 scroll-mt-24 border-border/70 shadow-none">
      <CardHeader className="flex flex-col gap-3 pb-0 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Resumo financeiro</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Escolha um mês, semestre ou ano. Clique numa barra do gráfico para ver aquele mês.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Toggle active={periodKey === currentMonthKey} onClick={() => onPeriodChange(currentMonthKey)}>Este mês</Toggle>
          <Toggle active={periodKey === previousMonthKey} onClick={() => onPeriodChange(previousMonthKey)}>Mês anterior</Toggle>
          <Toggle active={periodKey === currentSemesterKey} onClick={() => onPeriodChange(currentSemesterKey)}>Este semestre</Toggle>
          <Select value={periodKey} onValueChange={(value) => { if (value) onPeriodChange(value) }}>
            <SelectTrigger aria-label="Escolher período" className="h-8 w-auto min-w-44 text-xs"><SelectValue placeholder="Escolher período">{(value: string | null) => (value ? periodFromKey(value).label : "Escolher período")}</SelectValue></SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectLabel>Meses</SelectLabel>
                {options.months.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}{o.key === currentMonthKey ? ' (atual)' : ''}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Semestres</SelectLabel>
                {options.semesters.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Anos</SelectLabel>
                {options.years.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <PeriodSummary period={period} detail={detail} loading={loading} failed={failed} />

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <section aria-labelledby="finance-chart-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 id="finance-chart-title" className="text-sm font-semibold text-foreground">Faturamento por mês</h3>
                <p className="text-xs text-muted-foreground">Aluguéis iniciados em cada mês; cada troca conta como um novo aluguel.</p>
              </div>
              <div className="flex items-center gap-1.5">
                {period.kind === 'mes' ? (
                  <>
                    <Toggle active={range === 6} onClick={() => setRange(6)}>6 meses</Toggle>
                    <Toggle active={range === 12} onClick={() => setRange(12)}>12 meses</Toggle>
                  </>
                ) : null}
                <Button type="button" variant="ghost" size="icon-sm" aria-label={view === 'grafico' ? 'Ver em tabela' : 'Ver gráfico'} title={view === 'grafico' ? 'Ver em tabela' : 'Ver gráfico'} onClick={() => setView(view === 'grafico' ? 'tabela' : 'grafico')}>
                  {view === 'grafico' ? <Table2 /> : <BarChart3 />}
                </Button>
              </div>
            </div>
            {chartMonths.length
              ? view === 'grafico'
                ? <RevenueBars months={chartMonths} today={finance.today} selected={selectedMonths} onSelect={(month) => onPeriodChange(month)} />
                : <MonthTable months={chartMonths} onSelect={(month) => onPeriodChange(month)} />
              : <p className="mt-6 rounded-xl bg-muted/50 px-4 py-8 text-center text-xs text-muted-foreground">{loading ? 'Carregando…' : 'Sem dados para este período.'}</p>}

            {detail && detail.topNeighborhoods.length ? (
              <div className="mt-5">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><MapPin aria-hidden="true" className="size-3.5 text-primary" />Bairros com mais aluguéis · {period.label.toLowerCase()}</h4>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {detail.topNeighborhoods.map((n) => {
                    const max = detail.topNeighborhoods[0].rentals || 1
                    return (
                      <li key={n.neighborhood} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs">
                        <span className="truncate text-foreground">{n.neighborhood}</span>
                        <span className="h-2 rounded-full bg-muted" aria-hidden="true"><span className="block h-2 rounded-full bg-primary" style={{ width: `${(n.rentals / max) * 100}%` }} /></span>
                        <span className="tabular-nums text-muted-foreground">{plural(n.rentals, 'aluguel', 'aluguéis')} · {formatCurrency(n.revenue)}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="finance-due-title" className="rounded-xl border border-border/70 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 id="finance-due-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarClock aria-hidden="true" className="size-4 text-primary" />Vencimentos hoje
              </h3>
              <Button variant="ghost" size="xs" onClick={() => onNavigate('alugueis')} className="gap-1 text-muted-foreground">Aluguéis <ArrowRight data-icon="inline-end" /></Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {plural(finance.activeRentals, 'aluguel ativo', 'aluguéis ativos')} em {formatDate(finance.today)} · 7 dias contados a partir da entrega.
            </p>
            <DueList title="Vencidos" items={finance.overdue} tone="late" empty="Nenhum aluguel vencido." />
            <DueList title="Vencem hoje ou nos próximos 2 dias" items={finance.dueSoon} tone="soon" empty="Nenhum vencimento próximo." />
          </section>
        </div>
      </CardContent>
    </Card>
  )
}

function PeriodSummary({ period, detail, loading, failed }: { period: FinancePeriodOption; detail: FinancePeriodDetail | null; loading: boolean; failed: boolean }) {
  if (failed && !detail) {
    return <p className="rounded-xl bg-muted/50 px-4 py-3.5 text-sm text-muted-foreground">Não foi possível carregar este período. Confira se o backend está atualizado e tente de novo.</p>
  }
  if (!detail) {
    return <p className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3.5 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Carregando {period.label.toLowerCase()}…</p>
  }
  const prevName = previousLabel(period.kind, detail)
  const revenueChange = change(detail.revenue, detail.previous.revenue)
  const ticket = detail.rentals ? detail.revenue / detail.rentals : 0
  const top = detail.topNeighborhoods[0]
  const range = detail.partial ? `até ${shortDay(detail.to)}` : `${shortDay(detail.from)} a ${shortDay(detail.to)}`

  const comparison = (() => {
    if (detail.previous.rentals === 0 && detail.rentals === 0) return `Também não houve aluguéis em ${prevName}.`
    if (detail.previous.rentals === 0) return `Em ${prevName} não houve aluguéis.`
    const before = `${plural(detail.previous.rentals, 'aluguel', 'aluguéis')}, ${formatCurrency(detail.previous.revenue)}`
    if (revenueChange === 0) return `Mesmo faturamento de ${prevName} (${before}).`
    return `${revenueChange! > 0 ? 'Alta' : 'Queda'} de ${Math.abs(revenueChange!)}% em relação a ${prevName} (${before}).`
  })()

  return (
    <div className={cn('transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
      <div className="rounded-xl bg-muted/50 px-4 py-3.5 text-sm leading-6 text-foreground">
        <p>
          <span className="font-semibold">{period.label}</span> <span className="text-muted-foreground">({range}{detail.partial ? ', em andamento' : ''})</span>:{' '}
          {detail.rentals === 0 ? 'nenhum aluguel no período.' : (
            <>
              {plural(detail.rentals, 'aluguel', 'aluguéis')}{detail.swaps ? ` (${detail.swaps} por troca)` : ''} e{' '}
              <span className="font-semibold">{formatCurrency(detail.revenue)}</span> faturados.
            </>
          )}{' '}
          {comparison}
        </p>
        {detail.rentals ? (
          <p className="mt-1 text-muted-foreground">
            {plural(detail.customers, 'cliente atendido', 'clientes atendidos')}, {plural(detail.removals, 'retirada concluída', 'retiradas concluídas')} e ocupação média de {detail.occupancyPct.toLocaleString('pt-BR')}% da frota.
            {top ? ` Bairro com mais aluguéis: ${top.neighborhood} (${top.rentals}).` : ''}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faturamento" value={formatCurrency(detail.revenue)} caption={range} trend={revenueChange} trendCaption={`vs. ${prevName.replace(/ \(mesmo período.*\)$/, '')}`} />
        <Stat label="Aluguéis" value={String(detail.rentals)} caption={`${plural(detail.swaps, 'por troca', 'por troca')} · ${plural(detail.customers, 'cliente', 'clientes')}`} />
        <Stat label="Valor médio por aluguel" value={formatCurrency(ticket)} caption={detail.rentals ? 'no período' : 'sem aluguéis no período'} />
        <Stat label="Ocupação média da frota" value={`${detail.occupancyPct.toLocaleString('pt-BR')}%`} caption={`${plural(detail.removals, 'retirada', 'retiradas')} no período`} />
      </div>
    </div>
  )
}

function Stat({ label, value, caption, trend, trendCaption }: { label: string; value: string; caption?: string; trend?: number | null; trendCaption?: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      {caption ? <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p> : null}
      {trend !== undefined ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          {trend === null ? (
            <span className="font-medium text-foreground">Sem aluguéis no período anterior</span>
          ) : trend === 0 ? (
            <><Minus aria-hidden="true" className="size-3.5" /><span className="font-medium text-foreground">0%</span> {trendCaption}</>
          ) : (
            <>
              {trend > 0
                ? <ArrowUpRight aria-hidden="true" className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                : <ArrowDownRight aria-hidden="true" className="size-3.5 text-red-600 dark:text-red-400" />}
              <span className="font-medium text-foreground">{trend > 0 ? '+' : ''}{trend}%</span> {trendCaption}
            </>
          )}
        </p>
      ) : null}
    </div>
  )
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('h-8 rounded-lg px-2.5 text-xs font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
    >
      {children}
    </button>
  )
}

/** Valor "redondo" para o topo do eixo (1, 2, 2,5 ou 5 × 10ⁿ). */
function niceMax(value: number) {
  if (value <= 0) return 1000
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * exp >= value) return step * exp
  }
  return 10 * exp
}

function RevenueBars({ months, today, selected, onSelect }: { months: FinanceMonth[]; today: string; selected: Set<string>; onSelect: (month: string) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const top = niceMax(Math.max(...months.map((m) => m.revenue)))
  const maxIndex = months.reduce((best, m, i) => (m.revenue > months[best].revenue ? i : best), 0)
  const currentMonth = today.slice(0, 7)
  const ticks = [top, top / 2, 0]
  const height = 176

  return (
    <div className="mt-4">
      <div className="relative flex gap-2" style={{ height: height + 28 }}>
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }} aria-hidden="true">
          {ticks.map((tick) => (
            <div key={tick} className="absolute inset-x-0 flex items-center gap-2" style={{ top: height - (tick / top) * height }}>
              <span className="w-14 shrink-0 -translate-y-1/2 text-right text-[10px] text-muted-foreground tabular-nums">
                {tick >= 1000 ? `R$ ${(tick / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : formatCurrency(tick).replace(',00', '')}
              </span>
              <span className={cn('h-px flex-1 -translate-y-1/2', tick === 0 ? 'bg-border' : 'bg-border/50')} />
            </div>
          ))}
        </div>

        <div className="ml-16 flex flex-1 items-end gap-0.5" style={{ height }}>
          {months.map((m, i) => {
            const barHeight = m.revenue > 0 ? Math.max(4, (m.revenue / top) * height) : 0
            const partial = m.month === currentMonth
            const isSelected = selected.has(m.month)
            const showLabel = (isSelected && selected.size === 1 || i === maxIndex) && m.revenue > 0
            return (
              <button
                type="button"
                key={m.month}
                className="relative flex h-full flex-1 cursor-pointer flex-col items-center justify-end rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect(m.month)}
                aria-pressed={isSelected}
                aria-label={`${capitalize(monthName(m.month))} de ${m.month.slice(0, 4)}${partial ? ' (parcial)' : ''}: ${formatCurrency(m.revenue)}, ${plural(m.rentals, 'aluguel', 'aluguéis')}. Clique para ver este mês.`}
              >
                {showLabel ? <span className="mb-1 text-[10px] font-semibold text-foreground tabular-nums">{formatCurrency(m.revenue).replace(',00', '')}</span> : null}
                <span
                  className={cn('block w-full max-w-11 rounded-t-[4px] transition-colors', isSelected ? 'bg-primary' : 'bg-primary/25 dark:bg-primary/35', hover === i && !isSelected && 'bg-primary/45 dark:bg-primary/55')}
                  style={{ height: barHeight }}
                />
                {hover === i ? <Tooltip month={m} partial={partial} today={today} alignRight={i >= months.length / 2} bottom={barHeight + (showLabel ? 22 : 8)} /> : null}
              </button>
            )
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 ml-16 flex gap-0.5">
          {months.map((m, i) => (
            <span key={m.month} className={cn('flex-1 text-center text-[11px]', selected.has(m.month) ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {capitalize(monthName(m.month, 'short'))}
              {m.month.endsWith('-01') || i === 0 ? <span className="block text-[9px] text-muted-foreground">{m.month.slice(0, 4)}</span> : null}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Em destaque: o período escolhido. {months.some((m) => m.month === currentMonth) ? `${capitalize(monthName(currentMonth))} ainda está em andamento (até ${shortDay(today)}). ` : ''}Clique numa barra para ver aquele mês.
      </p>
    </div>
  )
}

function Tooltip({ month, partial, today, alignRight, bottom }: { month: FinanceMonth; partial: boolean; today: string; alignRight: boolean; bottom: number }) {
  // Ancorada logo acima da barra; abre para o lado com mais espaço.
  return (
    <span role="tooltip" style={{ bottom }} className={cn('pointer-events-none absolute z-10 block w-44 rounded-lg border border-border bg-popover p-3 text-left shadow-lg', alignRight ? 'right-0' : 'left-0')}>
      <span className="block text-xs font-semibold text-foreground">
        {capitalize(monthName(month.month))} de {month.month.slice(0, 4)}{partial ? ` · até ${shortDay(today)}` : ''}
      </span>
      <span className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[11px]">
        <span className="text-muted-foreground">Faturamento</span><span className="font-medium text-foreground tabular-nums">{formatCurrency(month.revenue)}</span>
        <span className="text-muted-foreground">Aluguéis</span><span className="font-medium text-foreground tabular-nums">{month.rentals}{month.swaps ? ` (${month.swaps} troca${month.swaps > 1 ? 's' : ''})` : ''}</span>
        <span className="text-muted-foreground">Clientes</span><span className="font-medium text-foreground tabular-nums">{month.customers}</span>
        <span className="text-muted-foreground">Ocupação média</span><span className="font-medium text-foreground tabular-nums">{month.occupancyPct.toLocaleString('pt-BR')}%</span>
      </span>
    </span>
  )
}

function MonthTable({ months, onSelect }: { months: FinanceMonth[]; onSelect: (month: string) => void }) {
  const rows = useMemo(() => [...months].reverse(), [months])
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr><th className="px-3 py-2 font-medium">Mês</th><th className="px-3 py-2 text-right font-medium">Aluguéis</th><th className="px-3 py-2 text-right font-medium">Trocas</th><th className="px-3 py-2 text-right font-medium">Faturamento</th><th className="px-3 py-2 text-right font-medium">Ocupação</th></tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.month} className="border-t border-border/70">
              <td className="px-3 py-2"><button type="button" onClick={() => onSelect(m.month)} className="text-left text-foreground underline-offset-2 hover:underline">{capitalize(monthName(m.month))} de {m.month.slice(0, 4)}</button></td>
              <td className="px-3 py-2 text-right tabular-nums">{m.rentals}</td>
              <td className="px-3 py-2 text-right tabular-nums">{m.swaps}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">{formatCurrency(m.revenue)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{m.occupancyPct.toLocaleString('pt-BR')}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DueList({ title, items, tone, empty }: { title: string; items: FinanceDue[]; tone: 'late' | 'soon'; empty: string }) {
  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {tone === 'late' ? <AlertTriangle aria-hidden="true" className="size-3.5 text-red-600 dark:text-red-400" /> : <CalendarClock aria-hidden="true" className="size-3.5 text-amber-600 dark:text-amber-400" />}
        {title} <span className="font-normal text-muted-foreground">({items.length})</span>
      </p>
      {items.length ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.slice(0, 5).map((item) => (
            <li key={item.rentalId} className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-foreground">{item.customerName}</span>
                <span className="block truncate text-[11px] text-muted-foreground">Caçamba {item.dumpsterId} · {item.neighborhood}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className={cn('block text-[11px] font-medium', tone === 'late' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')}>{dueText(item)}</span>
                <span className="block text-[10px] text-muted-foreground">{shortDay(item.endsAt)}</span>
              </span>
            </li>
          ))}
          {items.length > 5 ? <li className="px-1 text-[11px] text-muted-foreground">e mais {items.length - 5}.</li> : null}
        </ul>
      ) : <p className="mt-2 text-[11px] text-muted-foreground">{empty}</p>}
    </div>
  )
}
