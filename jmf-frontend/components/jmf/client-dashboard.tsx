'use client'

import { useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { JmfMap } from '@/components/jmf/map'
import { formatCurrency, formatDate, getGreeting } from '@/lib/jmf/format'
import {
  type CompanySettings,
  type Dumpster,
  type JmfCustomer,
  type RentalRecord,
} from '@/lib/jmf/types'
import { CustomerAvatar, PageHeader, PriceBlock, StatusBadge, periodLabel } from './ui'

const removalReasons = [
  'Caçamba cheia',
  'Não preciso mais',
  'Obra finalizada',
  'Outro',
]

const DAY_MS = 24 * 60 * 60 * 1000

/** Fim do período: data de início + período contratado (dias de calendário). */
function getDueDate(startedAt: string, period: number) {
  const start = new Date(`${startedAt.slice(0, 10)}T00:00:00`)
  return new Date(start.getTime() + period * DAY_MS)
}

function getDaysRemaining(startedAt: string | undefined, period: number) {
  if (!startedAt) return period
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((getDueDate(startedAt, period).getTime() - today.getTime()) / DAY_MS)
  return Math.min(period, Math.max(0, days))
}

export function ClientDashboard({
  customer,
  dumpster,
  activeRental,
  rate,
  availableCount,
  onRent,
  onTrack,
  onCreateSwap,
  onCreateRemoval,
  onWhatsApp,
}: {
  customer: JmfCustomer
  dumpster?: Dumpster
  activeRental?: RentalRecord
  rate: number
  availableCount: number
  onRent: () => void
  onTrack: () => void
  onCreateSwap: () => Promise<void>
  onCreateRemoval: (reason: string, notes: string) => Promise<void>
  onWhatsApp: () => void
}) {
  const [swapOpen, setSwapOpen] = useState(false)
  const [removalOpen, setRemovalOpen] = useState(false)
  const [swapLoading, setSwapLoading] = useState(false)
  const [removalLoading, setRemovalLoading] = useState(false)
  const [reason, setReason] = useState('Caçamba cheia')
  const [notes, setNotes] = useState('')
  const location = dumpster?.location
  const period = activeRental?.periodDays ?? 7
  const daysRemaining = getDaysRemaining(dumpster?.rentalStartedAt, period)
  const mapPoints = dumpster?.location
    ? [
        {
          id: dumpster.id,
          status: dumpster.status,
          customerName: customer.name,
          location: dumpster.location,
          rentalStartedAt: dumpster.rentalStartedAt,
        },
      ]
    : []

  const handleSwap = async () => {
    setSwapLoading(true)
    try {
      await onCreateSwap()
      setSwapOpen(false)
    } finally {
      setSwapLoading(false)
    }
  }

  const handleRemoval = async () => {
    setRemovalLoading(true)
    try {
      await onCreateRemoval(reason, notes)
      setRemovalOpen(false)
      setNotes('')
    } finally {
      setRemovalLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Área do cliente"
        title={`${getGreeting()}, ${customer.name.split(' ')[0]}`}
        description="Acompanhe seu aluguel e tenha tudo sobre a sua caçamba em um só lugar."
      >
        <Button onClick={onRent} className="h-10 gap-2 px-4">
          <Truck data-icon="inline-start" />
          Alugar caçamba
        </Button>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-none">
          <CardContent className="grid min-h-[270px] gap-5 p-5 sm:p-7 md:grid-cols-[1fr_0.8fr] md:items-center">
            <div className="flex h-full flex-col justify-between gap-7">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-primary-foreground/75">Minha caçamba</p>
                  {dumpster ? <StatusBadge status="em_uso" className="border-white/20 bg-white/10 text-white dark:border-white/20 dark:bg-white/10 dark:text-white">Em uso</StatusBadge> : null}
                </div>
                <div className="mt-4 flex items-end gap-3">
                  <h2 className="text-5xl font-semibold tracking-[-0.06em]">{dumpster?.id ?? '—'}</h2>
                  <p className="mb-1 text-sm text-primary-foreground/75">Caçamba padrão</p>
                </div>
                <div className="mt-5">
                  <p className="text-xs font-medium tracking-[0.12em] text-primary-foreground/60 uppercase">{period === 7 ? 'Aluguel semanal' : `Aluguel de ${period} dias`}</p>
                  <p className="mt-1 text-2xl font-semibold">{formatCurrency(activeRental?.weeklyPrice ?? rate)}<span className="ml-1 text-sm font-normal text-primary-foreground/70">{periodLabel(period)}</span></p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-primary-foreground/80">
                <span className="inline-flex items-center gap-2">
                  <MapPin aria-hidden="true" className="size-4" />
                  {location?.label ?? 'Nenhuma caçamba ativa'}
                </span>
                <span className="inline-flex items-center gap-2">
                  <CalendarDays aria-hidden="true" className="size-4" />
                  {dumpster?.rentalStartedAt ? `Desde ${formatDate(dumpster.rentalStartedAt)}` : 'Solicite sua primeira caçamba'}
                </span>
              </div>
            </div>

            <div className="relative min-h-48 overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-2">
              {mapPoints.length ? (
                <JmfMap points={mapPoints} height={218} className="overflow-hidden rounded-xl" />
              ) : (
                <button
                  type="button"
                  onClick={onRent}
                  className="flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-xl text-center text-primary-foreground/80 transition-colors hover:bg-white/5"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10">
                    <MapPin aria-hidden="true" className="size-5" />
                  </span>
                  <span className="text-sm">O mapa será exibido após a entrega</span>
                </button>
              )}
              {location ? (
                <div className="pointer-events-none absolute right-4 bottom-4 left-4 flex items-center justify-between rounded-xl border border-white/15 bg-white/95 px-3 py-2 text-slate-900 shadow-lg">
                  <span className="min-w-0 truncate text-xs font-medium">{location.street}, {location.number} · {location.neighborhood}</span>
                  <span className="ml-3 flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" /> Localização ativa</span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-0">
            <div>
              <CardTitle className="text-base">Resumo do período</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{period === 7 ? 'Seu aluguel semanal de 7 dias.' : `Seu aluguel de ${period} dias.`}</p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/15">
              <Clock3 aria-hidden="true" className="size-5" />
            </span>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-4xl font-semibold tracking-tight text-foreground">{dumpster ? daysRemaining : '—'}</p>
                <p className="mt-1 text-sm text-muted-foreground">dias restantes no período</p>
              </div>
              <p className="pb-1 text-xs font-medium text-muted-foreground">Período de {period} dias</p>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${dumpster ? Math.max(8, ((period - daysRemaining) / period) * 100) : 0}%` }} />
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Início: {dumpster?.rentalStartedAt ? formatDate(dumpster.rentalStartedAt) : '—'}</span>
              <span>Fim do período: {dumpster?.rentalStartedAt ? formatDate(getDueDate(dumpster.rentalStartedAt, period).toISOString()) : '—'}</span>
            </div>
            <Button variant="outline" onClick={onTrack} className="mt-6 h-10 w-full justify-between px-3.5">
              Acompanhar solicitação
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">O que você precisa fazer?</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Sua caçamba está no local. Escolha uma das ações abaixo.</p>
              </div>
              <PackageCheck aria-hidden="true" className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSwapOpen(true)}
              disabled={!dumpster}
              className="group flex min-h-28 items-start justify-between rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.025] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>
                <span className="mb-3 flex size-9 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/15"><RefreshCw aria-hidden="true" className="size-4" /></span>
                <span className="block text-sm font-semibold text-foreground">Trocar caçamba</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">Nova locação de {formatCurrency(rate)} · {period} dias</span>
              </span>
              <ChevronRight aria-hidden="true" className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={() => setRemovalOpen(true)}
              disabled={!dumpster}
              className="group flex min-h-28 items-start justify-between rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-amber-400/60 hover:bg-amber-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-amber-500/5"
            >
              <span>
                <span className="mb-3 flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Truck aria-hidden="true" className="size-4" /></span>
                <span className="block text-sm font-semibold text-foreground">Solicitar retirada</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">Agende a retirada da sua caçamba</span>
              </span>
              <ChevronRight aria-hidden="true" className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Precisa de ajuda?</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Fale com a equipe JMF sobre sua locação.</p>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 rounded-xl bg-muted/70 p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm">
                <MessageCircle aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Atendimento via WhatsApp</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Resposta direta da nossa equipe</p>
              </div>
              <Button variant="outline" size="sm" onClick={onWhatsApp}>Conversar</Button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="size-3.5 text-emerald-600" /> Atendimento em horário comercial</span>
              <Button variant="link" size="sm" onClick={onTrack} className="h-auto p-0">Ver histórico</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Etapas do seu aluguel</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhe cada atualização da equipe.</p>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { label: 'Solicitação', icon: Check, done: true },
                { label: 'Aprovação', icon: Check, done: true },
                { label: 'Entrega', icon: Truck, done: true },
                { label: 'Em uso', icon: PackageCheck, done: Boolean(dumpster) },
              ].map((step, index) => (
                <div key={step.label} className="relative flex items-start gap-3 sm:flex-col sm:gap-2.5">
                  {index < 3 ? <span className="absolute top-4 left-4 hidden h-px w-[calc(100%-1rem)] bg-border sm:block" /> : null}
                  <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-muted-foreground'}`}>
                    <step.icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="pt-1 text-sm font-medium text-foreground sm:pt-0">{step.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardContent className="flex items-center gap-4 p-5">
            <CustomerAvatar name={customer.name} initials={customer.initials} className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{customer.email}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Ver perfil" onClick={onTrack}>
              <ChevronRight />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary/8 text-primary dark:bg-primary/15"><RefreshCw aria-hidden="true" className="size-5" /></div>
            <DialogTitle>Solicitar troca de caçamba</DialogTitle>
            <DialogDescription>Uma nova caçamba inicia um novo período de locação, mesmo quando a troca acontece no mesmo dia.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">Novo aluguel de {period} dias</p>
            <PriceBlock price={rate} periodDays={period} />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">O aluguel atual será encerrado quando a equipe posicionar a nova caçamba.</p>
          </div>
          {availableCount === 0 ? <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">Não há caçambas livres agora. Sua solicitação será registrada para análise da equipe.</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapOpen(false)} disabled={swapLoading}>Cancelar</Button>
            <Button onClick={handleSwap} disabled={swapLoading} className="gap-2">
              <RefreshCw data-icon="inline-start" />
              {swapLoading ? 'Enviando...' : 'Confirmar troca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removalOpen} onOpenChange={setRemovalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar retirada</DialogTitle>
            <DialogDescription>Conte à equipe JMF por que você precisa retirar a caçamba. A solicitação será acompanhada pelo gestor.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="removal-reason">Motivo da retirada</FieldLabel>
              <Select value={reason} onValueChange={(value) => setReason(String(value ?? ''))}>
                <SelectTrigger id="removal-reason" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {removalReasons.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="removal-notes">Observação <span className="font-normal text-muted-foreground">(opcional)</span></FieldLabel>
              <Textarea id="removal-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informe um horário ou detalhe importante para a retirada." rows={3} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovalOpen(false)} disabled={removalLoading}>Cancelar</Button>
            <Button onClick={handleRemoval} disabled={removalLoading} className="gap-2">
              <Truck data-icon="inline-start" />
              {removalLoading ? 'Enviando...' : 'Confirmar retirada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ClientRentalShortcut({
  weeklyPrice,
  availableCount,
  onRent,
}: {
  weeklyPrice: number
  availableCount: number
  onRent: () => void
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/15"><Truck aria-hidden="true" className="size-5" /></span>
          <div>
            <p className="text-sm font-semibold text-foreground">Aluguel de caçamba padrão</p>
            <p className="mt-1 text-sm text-muted-foreground">Planos de 7, 15 ou 30 dias · a partir de {formatCurrency(weeklyPrice)}</p>
          </div>
        </div>
        <Button onClick={onRent} disabled={availableCount === 0} className="h-10 shrink-0 gap-2">
          {availableCount === 0 ? 'Sem disponibilidade' : 'Solicitar caçamba'}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardContent>
    </Card>
  )
}

export function ClientGreetingIcon() {
  return <CalendarDays aria-hidden="true" className="size-4" />
}
