'use client'

import { useState } from 'react'
import { Building2, Check, CircleHelp, Mail, MessageCircle, Phone, Save, Settings2, ShieldCheck, Truck } from 'lucide-react'
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatPhone } from '@/lib/jmf/format'
import type { CompanySettings } from '@/lib/jmf/types'
import { PageHeader } from './ui'

export function ManagerSettingsPage({
  settings,
  onSave,
}: {
  settings: CompanySettings
  onSave: (settings: CompanySettings) => void
}) {
  const [form, setForm] = useState(settings)
  const [priceValue, setPriceValue] = useState(String(settings.weeklyPrice))
  const [price15Value, setPrice15Value] = useState(String(settings.price15))
  const [price30Value, setPrice30Value] = useState(String(settings.price30))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const numericPrice = Number(priceValue.replace(',', '.'))
  const numericPrice15 = Number(price15Value.replace(',', '.'))
  const numericPrice30 = Number(price30Value.replace(',', '.'))
  const pricesValid = [numericPrice, numericPrice15, numericPrice30].every((value) => Number.isFinite(value) && value > 0)
  const pricesChanged = numericPrice !== settings.weeklyPrice || numericPrice15 !== settings.price15 || numericPrice30 !== settings.price30

  const updateForm = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const save = () => {
    if (!pricesValid) {
      toast.error('Informe valores maiores que zero para os três planos.')
      return
    }
    setSaving(true)
    const nextSettings = {
      ...form,
      weeklyPrice: numericPrice,
      price15: numericPrice15,
      price30: numericPrice30,
      whatsapp: form.whatsapp.replace(/\D/g, ''),
      phone: form.phone.trim(),
    }
    onSave(nextSettings)
    setForm(nextSettings)
    setSaving(false)
    setConfirmOpen(false)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pricesValid) {
      toast.error('Informe valores maiores que zero para os três planos.')
      return
    }
    if (pricesChanged) {
      setConfirmOpen(true)
      return
    }
    save()
  }

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Defina as regras de aluguel e os canais de atendimento da JMF." />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="border-b border-border/70 pb-4"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/15"><Truck aria-hidden="true" className="size-5" /></span><div><CardTitle className="text-base">Regras de aluguel</CardTitle><p className="mt-1 text-sm text-muted-foreground">Planos de 7, 15 e 30 dias oferecidos ao cliente. A troca gera um novo aluguel no mesmo plano.</p></div></div></CardHeader>
            <CardContent className="pt-5">
              <FieldGroup className="grid gap-5 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="weekly-price">7 dias (1 semana)</FieldLabel>
                  <div className="relative"><span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span><Input id="weekly-price" type="number" inputMode="decimal" min="1" step="0.01" value={priceValue} onChange={(event) => setPriceValue(event.target.value)} className="h-10 pl-9" required /></div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="price-15">15 dias</FieldLabel>
                  <div className="relative"><span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span><Input id="price-15" type="number" inputMode="decimal" min="1" step="0.01" value={price15Value} onChange={(event) => setPrice15Value(event.target.value)} className="h-10 pl-9" required /></div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="price-30">30 dias</FieldLabel>
                  <div className="relative"><span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span><Input id="price-30" type="number" inputMode="decimal" min="1" step="0.01" value={price30Value} onChange={(event) => setPrice30Value(event.target.value)} className="h-10 pl-9" required /></div>
                </Field>
              </FieldGroup>
              <FieldDescription className="mt-3">Os novos valores valem só para novas solicitações; contratos existentes mantêm o valor registrado.</FieldDescription>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-none">
            <CardHeader className="border-b border-border/70 pb-4"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Building2 aria-hidden="true" className="size-5" /></span><div><CardTitle className="text-base">Dados da empresa</CardTitle><p className="mt-1 text-sm text-muted-foreground">Informações exibidas nos contatos e comunicações.</p></div></div></CardHeader>
            <CardContent className="pt-5">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="company-name">Empresa</FieldLabel><Input id="company-name" value="JMF Entulhos" readOnly aria-readonly="true" className="h-10" /></Field>
                <Field><FieldLabel htmlFor="company-email">E-mail de atendimento</FieldLabel><Input id="company-email" type="email" autoComplete="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} className="h-10" /></Field>
                <Field><FieldLabel htmlFor="company-phone">Telefone</FieldLabel><Input id="company-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => updateForm('phone', formatPhone(event.target.value))} placeholder="(98) 9xxxx-xxxx" className="h-10" /></Field>
                <Field><FieldLabel htmlFor="company-whatsapp">WhatsApp</FieldLabel><div className="relative"><MessageCircle aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="company-whatsapp" type="tel" value={form.whatsapp} onChange={(event) => updateForm('whatsapp', event.target.value)} placeholder="55 98 9xxxx-xxxx" className="h-10 pl-9" /></div><FieldDescription>Use DDI + DDD + número, somente para gerar o link de contato.</FieldDescription></Field>
                <Field className="sm:col-span-2"><FieldLabel htmlFor="company-address">Endereço da empresa</FieldLabel><Input id="company-address" value={form.address} onChange={(event) => updateForm('address', event.target.value)} className="h-10" /></Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-muted-foreground">As alterações são salvas no servidor e valem para novas solicitações.</p><Button type="submit" disabled={saving} className="h-10 gap-2 px-4"><Save data-icon="inline-start" />Salvar configurações</Button></div>
        </form>

        <div className="flex flex-col gap-4">
          <Card className="border-border/70 shadow-none"><CardHeader className="pb-0"><CardTitle className="text-base">Prévia da locação</CardTitle><p className="mt-1 text-sm text-muted-foreground">Valor apresentado em novas solicitações.</p></CardHeader><CardContent className="pt-5"><div className="rounded-2xl bg-primary p-5 text-primary-foreground"><p className="text-xs font-medium tracking-[0.12em] text-primary-foreground/60 uppercase">Caçamba padrão</p><div className="mt-3 flex flex-col gap-2">{[[7, numericPrice], [15, numericPrice15], [30, numericPrice30]].map(([days, value]) => <p key={days} className="flex items-baseline justify-between gap-3"><span className="text-xs text-primary-foreground/70">{days} dias</span><span className="text-xl font-semibold tracking-tight">{formatCurrency(value > 0 ? value : 0)}</span></p>)}</div></div><div className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />O valor dos aluguéis já registrados não será alterado.</div></CardContent></Card>
          <Card className="border-border/70 shadow-none"><CardHeader className="pb-0"><CardTitle className="text-base">Atendimento</CardTitle><p className="mt-1 text-sm text-muted-foreground">Status dos canais de contato.</p></CardHeader><CardContent className="flex flex-col gap-3 pt-4"><div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3.5 py-3"><span className="flex items-center gap-2 text-sm"><MessageCircle aria-hidden="true" className="size-4 text-primary" />WhatsApp</span><span className="text-xs text-muted-foreground">{form.whatsapp.replace(/\D/g, '').length >= 12 ? 'Configurado' : 'Pendente'}</span></div><div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3.5 py-3"><span className="flex items-center gap-2 text-sm"><Mail aria-hidden="true" className="size-4 text-primary" />E-mail</span><span className="max-w-36 truncate text-xs text-muted-foreground">{form.email || 'Não informado'}</span></div><div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3.5 py-3"><span className="flex items-center gap-2 text-sm"><Phone aria-hidden="true" className="size-4 text-primary" />Telefone</span><span className="text-xs text-muted-foreground">{form.phone || 'Não informado'}</span></div></CardContent></Card>
          <Card className="border-border/70 bg-muted/30 shadow-none"><CardContent className="flex items-start gap-3 p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground"><CircleHelp aria-hidden="true" className="size-4" /></span><p className="text-xs leading-5 text-muted-foreground">Precisa mudar a frota? A quantidade inicial de 30 unidades e o modelo padrão são controlados na página de estoque.</p></CardContent></Card>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirmar alteração de preços</DialogTitle><DialogDescription>Novos valores: 7 dias {formatCurrency(numericPrice)} · 15 dias {formatCurrency(numericPrice15)} · 30 dias {formatCurrency(numericPrice30)}.</DialogDescription></DialogHeader>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">A alteração será aplicada apenas a novas locações. Aluguéis em andamento preservam o valor contratado.</div>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={save} className="gap-2"><Check data-icon="inline-start" />Confirmar valores</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
