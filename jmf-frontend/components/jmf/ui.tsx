import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  DUMPSTER_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  type ActivityItem,
  type DumpsterStatus,
  type RequestStatus,
  type RequestType,
} from '@/lib/jmf/types'
import { formatCurrency } from '@/lib/jmf/format'

const statusTones: Record<DumpsterStatus | RequestStatus, string> = {
  livre: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  ocupada: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  manutencao: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  indisponivel: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300',
  pendente: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  aprovada: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  em_entrega: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  entregue: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300',
  em_uso: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  troca_solicitada: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
  em_troca: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
  retirada_solicitada: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300',
  em_retirada: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300',
  finalizada: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  cancelada: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300',
  rejeitada: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
}

export function StatusBadge({
  status,
  className,
  children,
}: {
  status: DumpsterStatus | RequestStatus
  className?: string
  children?: React.ReactNode
}) {
  const label =
    status in DUMPSTER_STATUS_LABELS
      ? DUMPSTER_STATUS_LABELS[status as DumpsterStatus]
      : REQUEST_STATUS_LABELS[status as RequestStatus]

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 rounded-full px-2.5 py-1 font-medium', statusTones[status], className)}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-80" />
      {children ?? label}
    </Badge>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-primary/70 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto [&>button]:max-w-full">{children}</div> : null}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  caption,
  icon,
  trend,
  accent = 'navy',
}: {
  label: string
  value: string | number
  caption?: string
  icon: React.ReactNode
  trend?: { value: string; direction: 'up' | 'down' }
  accent?: 'navy' | 'green' | 'amber' | 'blue'
}) {
  const iconTone = {
    navy: 'bg-primary/8 text-primary dark:bg-primary/15 dark:text-primary',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  }[accent]

  return (
    <Card className="h-full border-border/70 shadow-none">
      <CardContent className="flex h-full items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {caption ? <p className="mt-1 text-xs text-muted-foreground">{caption}</p> : null}
          {trend ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {trend.direction === 'up' ? (
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              ) : (
                <ArrowDownRight aria-hidden="true" className="size-3.5" />
              )}
              {trend.value}
            </p>
          ) : null}
        </div>
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', iconTone)}>
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function CustomerAvatar({
  name,
  initials,
  className,
}: {
  name: string
  initials: string
  className?: string
}) {
  return (
    <span
      aria-label={name}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/8 text-xs font-semibold text-primary dark:bg-primary/15 dark:text-primary',
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <ClipboardList aria-hidden="true" className="size-5" />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function RequestTypeIcon({ type }: { type: RequestType }) {
  const Icon = {
    aluguel: Truck,
    troca: RefreshCw,
    retirada: PackageCheck,
  }[type]

  return <Icon aria-hidden="true" className="size-4" />
}

export function ActivityIcon({ kind }: { kind: ActivityItem['kind'] }) {
  const Icon = {
    solicitacao: ClipboardList,
    entrega: Truck,
    troca: RefreshCw,
    retirada: PackageCheck,
    estoque: CheckCircle2,
  }[kind]

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
      <Icon aria-hidden="true" className="size-4" />
    </span>
  )
}

export function PriceBlock({ price, compact = false }: { price: number; compact?: boolean }) {
  return (
    <div className={cn('flex items-baseline gap-1.5', compact && 'gap-1')}>
      <span className={cn('font-semibold tracking-tight text-foreground', compact ? 'text-sm' : 'text-2xl')}>
        {formatCurrency(price)}
      </span>
      <span className="text-xs text-muted-foreground">/ semana</span>
    </div>
  )
}

export function FeedbackIcon({ kind }: { kind: 'success' | 'warning' | 'error' }) {
  const Icon = {
    success: CheckCircle2,
    warning: AlertCircle,
    error: AlertCircle,
  }[kind]
  return <Icon aria-hidden="true" className="size-4" />
}

export function RequestTypeLabel({ type }: { type: RequestType }) {
  return REQUEST_TYPE_LABELS[type]
}
