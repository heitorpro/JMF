'use client'

import { ChevronLeft, ChevronRight, Clock3, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface TrackItem {
  key: string
  kind: 'aluguel' | 'pedido'
  title: string
  subtitle: string
}

/**
 * Seletor exibido quando o cliente tem mais de um aluguel ativo (ou um aluguel e um pedido em andamento):
 * escolhe qual acompanhar e permite alternar entre eles pelas abas ou pelas setas.
 */
export function RentalSwitcher({
  items,
  selectedKey,
  onSelect,
}: {
  items: TrackItem[]
  selectedKey: string
  onSelect: (key: string) => void
}) {
  const index = Math.max(0, items.findIndex((item) => item.key === selectedKey))
  const go = (delta: number) => onSelect(items[(index + delta + items.length) % items.length].key)
  const activeCount = items.filter((item) => item.kind === 'aluguel').length
  const pendingCount = items.length - activeCount

  return (
    <section aria-label="Escolha o aluguel para acompanhar" className="mb-5 rounded-2xl border border-border/70 bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {activeCount > 1 ? `Você tem ${activeCount} caçambas ativas` : activeCount === 1 ? 'Você tem 1 caçamba ativa' : 'Seus pedidos'}
            {pendingCount ? ` e ${pendingCount} ${pendingCount > 1 ? 'pedidos' : 'pedido'} em andamento` : ''}
          </p>
          <p className="text-xs text-muted-foreground">Escolha qual acompanhar · {index + 1} de {items.length}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Anterior" onClick={() => go(-1)}><ChevronLeft /></Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Próximo" onClick={() => go(1)}><ChevronRight /></Button>
        </div>
      </div>
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const selected = item.key === items[index].key
          const Icon = item.kind === 'aluguel' ? Truck : Clock3
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(item.key)}
              className={cn(
                'flex min-w-44 shrink-0 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                selected ? 'border-primary bg-primary/8 dark:bg-primary/15' : 'border-border hover:bg-muted/60',
              )}
            >
              <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
              <span className="min-w-0">
                <span className={cn('block text-sm font-semibold', selected ? 'text-primary' : 'text-foreground')}>{item.title}</span>
                <span className="block max-w-52 truncate text-[11px] text-muted-foreground">{item.subtitle}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
