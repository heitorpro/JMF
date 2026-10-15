'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, Mail, MapPin, Phone, Search, Truck, UsersRound } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/jmf/format'
import type { Dumpster, JmfCustomer, RentalRecord, RentalRequest } from '@/lib/jmf/types'
import { CustomerAvatar, EmptyState, PageHeader, StatusBadge } from './ui'

export function ManagerCustomersPage({
  customers,
  dumpsters,
  rentals,
  requests,
  searchQuery,
}: {
  customers: JmfCustomer[]
  dumpsters: Dumpster[]
  rentals: RentalRecord[]
  requests: RentalRequest[]
  searchQuery: string
}) {
  const [localQuery, setLocalQuery] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const query = `${searchQuery} ${localQuery}`.trim().toLocaleLowerCase('pt-BR')
  const filteredCustomers = useMemo(() => customers
    .filter((customer) => !query || `${customer.name} ${customer.cpf} ${customer.phone} ${customer.email} ${customer.currentDumpsterId ?? ''}`.toLocaleLowerCase('pt-BR').includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [customers, query])
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId)
  const currentDumpster = selectedCustomer?.currentDumpsterId
    ? dumpsters.find((dumpster) => dumpster.id === selectedCustomer.currentDumpsterId)
    : undefined
  const customerRentals = selectedCustomer
    ? rentals.filter((rental) => rental.customerId === selectedCustomer.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    : []
  const customerRequests = selectedCustomer
    ? requests.filter((request) => request.customerId === selectedCustomer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []
  const activeCustomers = customers.filter((customer) => customer.status === 'ativo').length

  return (
    <>
      <PageHeader eyebrow="Relacionamento" title="Clientes" description="Consulte cadastros, locações atuais e o histórico de atendimento." >
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><UsersRound aria-hidden="true" className="size-4 text-primary" />{activeCustomers} clientes ativos</div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Clientes cadastrados</p><p className="mt-2 text-2xl font-semibold">{customers.length}</p></CardContent></Card>
        <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Com caçamba em uso</p><p className="mt-2 text-2xl font-semibold">{customers.filter((customer) => customer.currentDumpsterId).length}</p></CardContent></Card>
        <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Aluguéis registrados</p><p className="mt-2 text-2xl font-semibold">{rentals.length}</p></CardContent></Card>
      </div>

      <Card className="mt-5 border-border/70 shadow-none">
        <CardHeader className="pb-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="text-base">Base de clientes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Abra um cadastro para ver os detalhes de locação e atendimento.</p></div>
            <div className="relative w-full sm:max-w-xs"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar cliente" value={localQuery} onChange={(event) => setLocalQuery(event.target.value)} placeholder="Buscar por nome, e-mail ou caçamba" className="h-9 pl-9" /></div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {filteredCustomers.length ? (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>CPF</TableHead><TableHead>Contato</TableHead><TableHead>Aluguéis</TableHead><TableHead>Caçamba atual</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell><div className="flex items-center gap-2.5"><CustomerAvatar name={customer.name} initials={customer.initials} className="size-8" /><span className="min-w-0"><span className="block max-w-40 truncate font-medium">{customer.name}</span><span className="mt-0.5 block max-w-40 truncate text-xs text-muted-foreground">{customer.email}</span></span></div></TableCell>
                        <TableCell className="text-muted-foreground">{customer.cpf}</TableCell>
                        <TableCell><a className="text-sm text-muted-foreground hover:text-primary" href={`tel:${customer.phone.replace(/\D/g, '')}`}>{customer.phone}</a></TableCell>
                        <TableCell>{customer.totalRentals}</TableCell>
                        <TableCell>{customer.currentDumpsterId ? <span className="font-semibold">{customer.currentDumpsterId}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell><Badge variant={customer.status === 'ativo' ? 'secondary' : 'outline'}>{customer.status === 'ativo' ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setSelectedCustomerId(customer.id)}>Detalhes <ArrowUpRight data-icon="inline-end" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 md:hidden">
                {filteredCustomers.map((customer) => (
                  <button key={customer.id} type="button" onClick={() => setSelectedCustomerId(customer.id)} className="flex items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50">
                    <CustomerAvatar name={customer.name} initials={customer.initials} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{customer.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{customer.email}</span><span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">{customer.currentDumpsterId ? <>{customer.currentDumpsterId} · {customer.totalRentals} aluguéis</> : `${customer.totalRentals} aluguéis`}</span></span>
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </>
          ) : <EmptyState title="Nenhum cliente encontrado" description="Tente buscar por outro nome, e-mail ou identificação de caçamba." />}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedCustomer)} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedCustomer ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3"><CustomerAvatar name={selectedCustomer.name} initials={selectedCustomer.initials} className="size-12" /><div><DialogTitle>{selectedCustomer.name}</DialogTitle><DialogDescription>{selectedCustomer.email}</DialogDescription></div></div>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4"><p className="text-xs font-medium text-muted-foreground">Cadastro</p><p className="mt-3 text-sm"><span className="block text-xs text-muted-foreground">CPF</span><span className="mt-1 block font-medium">{selectedCustomer.cpf}</span></p><p className="mt-3 text-sm"><span className="block text-xs text-muted-foreground">Telefone</span><a className="mt-1 inline-block font-medium hover:text-primary" href={`tel:${selectedCustomer.phone.replace(/\D/g, '')}`}>{selectedCustomer.phone}</a></p><p className="mt-3 text-sm"><span className="block text-xs text-muted-foreground">E-mail</span><a className="mt-1 inline-block truncate font-medium hover:text-primary" href={`mailto:${selectedCustomer.email}`}>{selectedCustomer.email}</a></p></div>
                <div className="rounded-xl border border-border p-4"><p className="text-xs font-medium text-muted-foreground">Aluguel atual</p>{currentDumpster ? <><div className="mt-3 flex items-center justify-between"><span className="text-xl font-semibold">{currentDumpster.id}</span><StatusBadge status={currentDumpster.status} /></div><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{currentDumpster.location?.street}, {currentDumpster.location?.number} · {currentDumpster.location?.label}</p><p className="mt-2 text-xs text-muted-foreground">Início: {currentDumpster.rentalStartedAt ? formatDate(currentDumpster.rentalStartedAt) : '—'}</p></> : <p className="mt-3 text-sm text-muted-foreground">Sem aluguel ativo.</p>}</div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Histórico de aluguéis</h3><span className="text-xs text-muted-foreground">{customerRentals.length} registros</span></div>
                {customerRentals.length ? <div className="mt-3 flex flex-col divide-y divide-border/70">{customerRentals.slice(0, 5).map((rental) => <div key={rental.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-sm font-medium">{rental.dumpsterId} · {rental.operation === 'troca' ? 'Troca / novo aluguel' : 'Locação'}</p><p className="mt-1 truncate text-xs text-muted-foreground">{formatDate(rental.startedAt)} · {rental.location.label}</p></div><span className="shrink-0 text-right"><span className="block text-sm font-semibold">{formatCurrency(rental.weeklyPrice)}</span><span className="mt-1 block text-[11px] text-muted-foreground">{rental.status === 'ativo' ? 'Ativo' : 'Encerrado'}</span></span></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Nenhum aluguel registrado.</p>}
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Solicitações recentes</h3><span className="text-xs text-muted-foreground">{customerRequests.length} registros</span></div>
                {customerRequests.length ? <div className="mt-3 flex flex-col gap-2">{customerRequests.slice(0, 4).map((request) => <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5"><div className="min-w-0"><p className="text-xs font-medium">{request.id} · {request.type}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{formatDate(request.createdAt)}</p></div><StatusBadge status={request.status} /></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Nenhuma solicitação recente.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`tel:${selectedCustomer.phone.replace(/\D/g, '')}`} className={buttonVariants({ variant: 'outline' })}><Phone data-icon="inline-start" />Ligar</a>
                <a href={`mailto:${selectedCustomer.email}`} className={buttonVariants({ variant: 'outline' })}><Mail data-icon="inline-start" />Enviar e-mail</a>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
