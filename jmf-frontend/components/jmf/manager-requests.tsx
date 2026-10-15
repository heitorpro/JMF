'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  ClipboardList,
  MapPin,
  RefreshCw,
  Truck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/jmf/format'
import {
  getNextRequestStatus,
  getLocationLabel,
  REQUEST_TYPE_LABELS,
  type Dumpster,
  type JmfCustomer,
  type RentalRequest,
  type RequestStatus,
} from '@/lib/jmf/types'
import { CustomerAvatar, EmptyState, PageHeader, RequestTypeIcon, StatusBadge } from './ui'

const requestFilters = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendentes', label: 'Pendentes' },
  { id: 'entregas', label: 'Entregas' },
  { id: 'trocas', label: 'Trocas' },
  { id: 'retiradas', label: 'Retiradas' },
  { id: 'encerradas', label: 'Encerradas' },
] as const

type RequestFilter = (typeof requestFilters)[number]['id']

function matchesFilter(request: RentalRequest, filter: RequestFilter) {
  if (filter === 'todas') return true
  if (filter === 'pendentes') return ['pendente', 'troca_solicitada', 'retirada_solicitada'].includes(request.status)
  if (filter === 'entregas') return request.type === 'aluguel' && ['aprovada', 'em_entrega', 'entregue'].includes(request.status)
  if (filter === 'trocas') return request.type === 'troca'
  if (filter === 'retiradas') return request.type === 'retirada'
  return ['finalizada', 'cancelada', 'rejeitada'].includes(request.status)
}

function requestActionLabel(request: RentalRequest) {
  if (request.type === 'troca' && ['troca_solicitada', 'em_troca'].includes(request.status)) return 'Selecionar caçamba'
  const nextStatus = getNextRequestStatus(request)
  if (!nextStatus) return null
  const labels: Partial<Record<RequestStatus, string>> = {
    aprovada: 'Aprovar pedido',
    em_entrega: 'Iniciar entrega',
    entregue: 'Confirmar posicionamento',
    em_uso: 'Ativar aluguel',
    em_retirada: 'Iniciar retirada',
    finalizada: 'Finalizar retirada',
  }
  return labels[nextStatus] ?? 'Avançar etapa'
}

export function ManagerRequests({
  requests,
  dumpsters,
  customers,
  searchQuery,
  onAdvance,
  onReject,
  onCompleteSwap,
}: {
  requests: RentalRequest[]
  dumpsters: Dumpster[]
  customers: JmfCustomer[]
  searchQuery: string
  onAdvance: (requestId: string) => void
  onReject: (requestId: string) => void
  onCompleteSwap: (requestId: string, newDumpsterId: string) => void
}) {
  const [filter, setFilter] = useState<RequestFilter>('todas')
  const [swapRequestId, setSwapRequestId] = useState<string | null>(null)
  const [replacementId, setReplacementId] = useState('')
  const availableDumpsters = dumpsters.filter((dumpster) => dumpster.status === 'livre')
  const selectedSwapRequest = requests.find((request) => request.id === swapRequestId)
  const lowerQuery = searchQuery.trim().toLocaleLowerCase('pt-BR')
  const filteredRequests = useMemo(() => requests
    .filter((request) => matchesFilter(request, filter))
    .filter((request) => !lowerQuery || `${request.id} ${request.customerName} ${request.location.label} ${request.type}`.toLocaleLowerCase('pt-BR').includes(lowerQuery))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [filter, lowerQuery, requests])

  const openSwap = (request: RentalRequest) => {
    setSwapRequestId(request.id)
    setReplacementId(availableDumpsters[0]?.id ?? '')
  }

  const handleSwap = () => {
    if (!selectedSwapRequest || !replacementId) {
      toast.error('Selecione uma caçamba livre para concluir a troca.')
      return
    }
    onCompleteSwap(selectedSwapRequest.id, replacementId)
    setSwapRequestId(null)
    setReplacementId('')
  }

  const renderActions = (request: RentalRequest) => {
    const actionLabel = requestActionLabel(request)
    if (!actionLabel) return <span className="text-xs text-muted-foreground">Sem ação pendente</span>

    if (request.type === 'troca' && ['troca_solicitada', 'em_troca'].includes(request.status)) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => openSwap(request)} disabled={availableDumpsters.length === 0} className="h-10 min-w-0 flex-1 gap-1.5 sm:h-9 sm:flex-none">
            <RefreshCw data-icon="inline-start" />{availableDumpsters.length ? actionLabel : 'Sem caçamba livre'}
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Rejeitar ${request.id}`} onClick={() => onReject(request.id)}><X /></Button>
        </div>
      )
    }

    if (request.status === 'pendente') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => onAdvance(request.id)} className="h-10 min-w-0 flex-1 gap-1.5 sm:h-9 sm:flex-none"><Check data-icon="inline-start" />Aprovar</Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Rejeitar ${request.id}`} onClick={() => onReject(request.id)}><X /></Button>
        </div>
      )
    }

    return <Button size="sm" variant="outline" onClick={() => onAdvance(request.id)} className="h-10 w-full justify-center gap-1.5 sm:h-9 sm:w-auto">{actionLabel}<ArrowRight data-icon="inline-end" /></Button>
  }

  return (
    <>
      <PageHeader eyebrow="Operação" title="Solicitações" description="Analise novos aluguéis, acompanhe entregas e organize trocas e retiradas." >
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><ClipboardList aria-hidden="true" className="size-4 text-primary" /><span><strong className="text-foreground">{requests.length}</strong> solicitações</span></div>
      </PageHeader>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="text-base">Fila de atendimento</CardTitle><p className="mt-1 text-sm text-muted-foreground">Acompanhe o tipo, o local e a próxima ação de cada pedido.</p></div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><CircleAlert aria-hidden="true" className="size-4 text-amber-600" />{requests.filter((request) => ['pendente', 'troca_solicitada', 'retirada_solicitada'].includes(request.status)).length} aguardando análise</div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as RequestFilter)} className="gap-0">
            <TabsList variant="line" className="mb-4 w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
              {requestFilters.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className="min-w-fit rounded-none px-3 py-2.5 text-xs sm:text-sm">
                  {item.label}<span className="ml-1 text-[10px] text-muted-foreground">{requests.filter((request) => matchesFilter(request, item.id)).length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={filter} className="mt-0">
            <p className="mb-3 text-xs text-muted-foreground lg:hidden">Deslize os filtros para ver todas as categorias.</p>
              {filteredRequests.length ? (
                <>
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader><TableRow><TableHead>Solicitação</TableHead><TableHead>Cliente</TableHead><TableHead>Local e data</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Próxima ação</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {filteredRequests.map((request) => {
                          const customer = customers.find((item) => item.id === request.customerId)
                          return (
                            <TableRow key={request.id}>
                              <TableCell><div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><RequestTypeIcon type={request.type} /></span><span><span className="block font-semibold">{request.id}</span><span className="mt-0.5 block text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[request.type]}</span></span></div></TableCell>
                              <TableCell><div className="flex items-center gap-2.5"><CustomerAvatar name={request.customerName} initials={customer?.initials ?? request.customerName.split(' ').map((part) => part[0]).slice(0, 2).join('')} className="size-8" /><span className="min-w-0"><span className="block max-w-36 truncate text-sm font-medium">{request.customerName}</span><span className="mt-0.5 block text-xs text-muted-foreground">{request.dumpsterId ? `Caçamba ${request.dumpsterId}` : 'Nova locação'}</span></span></div></TableCell>
                              <TableCell><span className="block max-w-48 truncate text-sm">{getLocationLabel(request.location)}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(request.desiredDate)}</span></TableCell>
                              <TableCell className="font-medium">{request.price ? `${formatCurrency(request.price)}/sem.` : '—'}</TableCell>
                              <TableCell><StatusBadge status={request.status} /></TableCell>
                              <TableCell><div className="flex justify-end">{renderActions(request)}</div></TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col gap-3 lg:hidden">
                    {filteredRequests.map((request) => {
                      const customer = customers.find((item) => item.id === request.customerId)
                      return (
                        <article key={request.id} className="rounded-xl border border-border p-4">
                          <div className="flex items-start gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><RequestTypeIcon type={request.type} /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{request.id}</p><StatusBadge status={request.status} /></div>
                              <p className="mt-1 text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[request.type]}</p>
                              <div className="mt-3 flex items-center gap-2"><CustomerAvatar name={request.customerName} initials={customer?.initials ?? 'CL'} className="size-7" /><span className="truncate text-sm font-medium">{request.customerName}</span></div>
                              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin aria-hidden="true" className="size-3.5" />{getLocationLabel(request.location)}</p>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays aria-hidden="true" className="size-3.5" />{formatDate(request.desiredDate)}<span className="ml-auto font-semibold text-foreground">{request.price ? `${formatCurrency(request.price)}/sem.` : '—'}</span></div>
                              <div className="mt-4 flex justify-end">{renderActions(request)}</div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </>
              ) : <EmptyState title="Nenhuma solicitação encontrada" description={lowerQuery ? 'Tente ajustar a busca ou escolher outro filtro.' : 'Novas solicitações aparecerão aqui.'} />}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={Boolean(swapRequestId)} onOpenChange={(open) => !open && setSwapRequestId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir troca de caçamba</DialogTitle>
            <DialogDescription>{selectedSwapRequest?.customerName} receberá uma nova caçamba. A unidade atual será liberada e um novo aluguel será registrado.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Caçamba atual</span><strong>{selectedSwapRequest?.dumpsterId ?? '—'}</strong></div>
            <div className="mt-2 flex items-center justify-between gap-3"><span className="text-muted-foreground">Nova cobrança</span><strong>{formatCurrency(selectedSwapRequest?.price ?? 300)} / semana</strong></div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">A troca é registrada como um novo aluguel, inclusive quando ocorre no mesmo dia.</p>
          </div>
          {availableDumpsters.length ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="replacement-dumpster">Nova caçamba disponível</FieldLabel>
                <Select value={replacementId} onValueChange={(value) => setReplacementId(String(value ?? ''))}>
                  <SelectTrigger id="replacement-dumpster" className="w-full"><SelectValue placeholder="Selecione uma caçamba" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>{availableDumpsters.map((dumpster) => <SelectItem key={dumpster.id} value={dumpster.id}>{dumpster.id} · {dumpster.status === 'livre' ? 'Livre' : dumpster.status}</SelectItem>)}</SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          ) : <p role="alert" className="text-sm text-destructive">Não há caçambas livres para concluir esta troca.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapRequestId(null)}>Cancelar</Button>
            <Button onClick={handleSwap} disabled={!replacementId || availableDumpsters.length === 0} className="gap-2"><RefreshCw data-icon="inline-start" />Confirmar troca</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
