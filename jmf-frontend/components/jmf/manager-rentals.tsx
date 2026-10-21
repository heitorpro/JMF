'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, CalendarDays, Search, TrendingUp, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/jmf/format'
import type { RentalRecord } from '@/lib/jmf/types'
import { CustomerAvatar, EmptyState, PageHeader } from './ui'

export function ManagerRentalsPage({
  rentals,
  searchQuery,
}: {
  rentals: RentalRecord[]
  searchQuery: string
}) {
  const [localQuery, setLocalQuery] = useState('')
  const query = `${searchQuery} ${localQuery}`.trim().toLocaleLowerCase('pt-BR')
  const filteredRentals = useMemo(() => rentals
    .filter((rental) => !query || `${rental.id} ${rental.customerName} ${rental.dumpsterId} ${rental.location.label}`.toLocaleLowerCase('pt-BR').includes(query))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [rentals, query])
  const activeRentals = rentals.filter((rental) => rental.status === 'ativo')
  const totalWeekly = activeRentals.reduce((sum, rental) => sum + rental.weeklyPrice, 0)

  return (
    <>
      <PageHeader eyebrow="Operação" title="Aluguéis" description="Histórico de locações, cobranças por período (7, 15 ou 30 dias) e trocas registradas como novos aluguéis." >
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><CalendarDays aria-hidden="true" className="size-4 text-primary" />Período padrão: 7 dias</div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/70 shadow-none"><CardContent className="flex items-start justify-between gap-3 p-4"><div><p className="text-xs text-muted-foreground">Aluguéis ativos</p><p className="mt-2 text-2xl font-semibold">{activeRentals.length}</p></div><span className="flex size-9 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/15"><Truck aria-hidden="true" className="size-4" /></span></CardContent></Card>
        <Card className="border-border/70 shadow-none"><CardContent className="flex items-start justify-between gap-3 p-4"><div><p className="text-xs text-muted-foreground">Valor das locações ativas</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(totalWeekly)}</p></div><span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><TrendingUp aria-hidden="true" className="size-4" /></span></CardContent></Card>
        <Card className="border-border/70 shadow-none"><CardContent className="flex items-start justify-between gap-3 p-4"><div><p className="text-xs text-muted-foreground">Operações registradas</p><p className="mt-2 text-2xl font-semibold">{rentals.length}</p></div><span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"><CalendarDays aria-hidden="true" className="size-4" /></span></CardContent></Card>
      </div>

      <Card className="mt-5 border-border/70 shadow-none">
        <CardHeader className="pb-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Todos os aluguéis</CardTitle><p className="mt-1 text-sm text-muted-foreground">O valor de cada registro é congelado na criação do aluguel.</p></div><div className="relative w-full sm:max-w-xs"><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar aluguel" value={localQuery} onChange={(event) => setLocalQuery(event.target.value)} placeholder="Buscar cliente ou caçamba" className="h-9 pl-9" /></div></div>
        </CardHeader>
        <CardContent className="pt-4">
          {filteredRentals.length ? (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente e aluguel</TableHead><TableHead>Caçamba</TableHead><TableHead>Período</TableHead><TableHead>Local</TableHead><TableHead>Valor do período</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>{filteredRentals.map((rental) => <TableRow key={rental.id}><TableCell><div className="flex items-center gap-2.5"><CustomerAvatar name={rental.customerName} initials={rental.customerName.split(' ').map((part) => part[0]).slice(0, 2).join('')} className="size-8" /><span><span className="block text-sm font-medium">{rental.customerName}</span><span className="mt-0.5 block text-xs text-muted-foreground">{rental.id} · {rental.operation === 'troca' ? 'Novo aluguel por troca' : 'Locação'}</span></span></div></TableCell><TableCell className="font-semibold">{rental.dumpsterId}</TableCell><TableCell><span className="block text-sm">{formatDate(rental.startedAt)}</span><span className="mt-0.5 block text-xs text-muted-foreground">{rental.endedAt ? `Até ${formatDate(rental.endedAt)}` : 'Período em andamento'}</span></TableCell><TableCell className="max-w-48 truncate">{rental.location.label}</TableCell><TableCell>{formatCurrency(rental.weeklyPrice)} <span className="text-xs text-muted-foreground">· {rental.periodDays} dias</span></TableCell><TableCell><Badge variant={rental.status === 'ativo' ? 'default' : 'secondary'}>{rental.status === 'ativo' ? 'Ativo' : 'Encerrado'}</Badge></TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 md:hidden">{filteredRentals.map((rental) => <article key={rental.id} className="rounded-xl border border-border p-4"><div className="flex items-start gap-3"><CustomerAvatar name={rental.customerName} initials={rental.customerName.split(' ').map((part) => part[0]).slice(0, 2).join('')} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{rental.customerName}</p><Badge variant={rental.status === 'ativo' ? 'default' : 'secondary'}>{rental.status === 'ativo' ? 'Ativo' : 'Encerrado'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{rental.id} · {rental.dumpsterId} · {rental.operation === 'troca' ? 'Troca' : 'Locação'}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">Início</p><p className="mt-1 font-medium">{formatDate(rental.startedAt)}</p></div><div><p className="text-muted-foreground">Valor do período</p><p className="mt-1 font-medium">{formatCurrency(rental.weeklyPrice)}</p></div><p className="col-span-2 flex items-center gap-1.5 text-muted-foreground"><ArrowUpRight aria-hidden="true" className="size-3.5" />{rental.location.label}</p></div></article>)}</div>
            </>
          ) : <EmptyState title="Nenhum aluguel encontrado" description="Tente ajustar os termos da busca." />}
        </CardContent>
      </Card>
    </>
  )
}
