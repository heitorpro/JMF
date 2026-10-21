'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  FileText,
  MapPin,
  MessageCircle,
  Navigation,
  Paperclip,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { JmfMap } from '@/components/jmf/map'
import { formatCurrency, formatDate, toDateInputValue } from '@/lib/jmf/format'
import { geocodeAddress, lookupCep, reverseGeocode, type ResolvedAddress } from '@/lib/jmf/geocode'
import { isValidCpf, isValidPhone, maskCep, maskCpf, maskPhone } from '@/lib/jmf/masks'
import {
  getLocationLabel,
  buildLocation,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  type CompanySettings,
  type RentalPlan,
  type Dumpster,
  type JmfCustomer,
  type LocationAddress,
  type RentalRecord,
  type RentalRequest,
  type RentalRequestInput,
} from '@/lib/jmf/types'
import { CustomerAvatar, EmptyState, PageHeader, PriceBlock, StatusBadge } from './ui'

const fieldError = 'text-xs text-destructive'

function buildAddressLabel(address: LocationAddress) {
  if (address.source === 'gps') return `Localização atual · ${address.city} — ${address.state}`
  return getLocationLabel(address)
}

export function ClientRentalPage({
  customer,
  weeklyPrice,
  plans = [],
  availableCount,
  onSubmit,
  onBack,
}: {
  customer: JmfCustomer
  weeklyPrice: number
  plans?: RentalPlan[]
  availableCount: number
  onSubmit: (input: RentalRequestInput) => Promise<void>
  onBack: () => void
}) {
  const availablePlans = plans.length ? plans : [{ days: 7, price: weeklyPrice }]
  const [periodDays, setPeriodDays] = useState(availablePlans[0].days)
  const selectedPrice = availablePlans.find((plan) => plan.days === periodDays)?.price ?? weeklyPrice
  const [desiredDate, setDesiredDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return toDateInputValue(date)
  })
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [complement, setComplement] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [details, setDetails] = useState('')
  const [notes, setNotes] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number; source: 'endereco' | 'gps' } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // O endereço completo é sempre obrigatório; o GPS só fornece as coordenadas exatas.
  const addressComplete = Boolean(
    street.trim() && number.trim() && neighborhood.trim() && postalCode.trim() && city.trim() && state.trim(),
  )

  const addressFields = useMemo(() => ({
    postalCode: postalCode.trim(),
    street: street.trim(),
    number: number.trim(),
    neighborhood: neighborhood.trim(),
    complement: complement.trim(),
    city: city.trim(),
    state: state.trim().toUpperCase(),
  }), [city, complement, neighborhood, number, postalCode, state, street])

  // Prévia no mapa assim que houver coordenadas (GPS ou endereço localizado).
  const location = useMemo(() => {
    if (!coordinates) return null
    return buildLocation({ ...addressFields, source: coordinates.source }, coordinates)
  }, [addressFields, coordinates])

  const [geocoding, setGeocoding] = useState(false)
  const lastGeocoded = useRef('')

  /** Preenche os campos com o que veio do GPS ou do CEP, sem apagar o que já foi digitado. */
  const fillAddress = (found: Partial<ResolvedAddress>, overwrite: boolean) => {
    const pick = (current: string, next?: string) => (next && (overwrite || !current.trim()) ? next : current)
    if (found.postalCode) setPostalCode((current) => maskCep(pick(current, found.postalCode)))
    setStreet((current) => pick(current, found.street))
    setNumber((current) => pick(current, found.number))
    setNeighborhood((current) => pick(current, found.neighborhood))
    setCity((current) => pick(current, found.city))
    setState((current) => pick(current, found.state))
  }

  // Endereço → mapa: com o endereço completo e sem coordenadas, localiza automaticamente.
  useEffect(() => {
    if (!addressComplete || coordinates) return
    const key = JSON.stringify(addressFields)
    if (key === lastGeocoded.current) return
    const timer = window.setTimeout(async () => {
      lastGeocoded.current = key
      setGeocoding(true)
      const found = await geocodeAddress(addressFields)
      setGeocoding(false)
      if (found) setCoordinates({ ...found, source: 'endereco' })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [addressComplete, addressFields, coordinates])

  const mapPoints = location
    ? [{ id: 'Ponto solicitado', status: 'livre' as const, customerName: customer.name, location }]
    : []

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Seu navegador não oferece acesso à localização.')
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setCoordinates({ latitude, longitude, source: 'gps' })
        // GPS → endereço: preenche os campos a partir das coordenadas.
        const found = await reverseGeocode(latitude, longitude)
        if (found) {
          fillAddress(found, true)
          toast.success('Localização adicionada e endereço preenchido. Confira o número e o complemento.')
        } else {
          toast.success('Localização adicionada. Complete o endereço manualmente.')
        }
        setLocationLoading(false)
      },
      () => {
        toast.error('Não foi possível obter sua localização. Confira as permissões do navegador.')
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  // CEP → endereço: ao completar 8 dígitos, busca rua, bairro, cidade e UF.
  const handleCepChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(event.target.value)
    setPostalCode(masked)
    setCoordinates((current) => current?.source === 'endereco' ? null : current)
    if (masked.replace(/\D/g, '').length === 8) {
      const found = await lookupCep(masked)
      if (found) fillAddress(found, false)
      else toast.error('CEP não encontrado. Confira os números ou preencha o endereço.')
    }
  }

  const handleAddressChange = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value)
    // Coordenadas obtidas pelo endereço deixam de valer quando o endereço muda; as do GPS continuam.
    setCoordinates((current) => current?.source === 'endereco' ? null : current)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: string[] = []
    if (!desiredDate) nextErrors.push('Informe a data desejada.')
    if (!addressComplete) nextErrors.push('Informe o endereço completo: CEP, rua, número, bairro, cidade e UF.')
    if (details.trim().length < 4) nextErrors.push('Descreva brevemente os detalhes da obra.')
    setErrors(nextErrors)
    if (nextErrors.length) return

    setSubmitting(true)
    let finalLocation = location
    if (!finalLocation) {
      const found = await geocodeAddress(addressFields)
      if (!found) {
        setErrors(['Não conseguimos localizar esse endereço no mapa. Toque em "Usar minha localização" no local da obra ou confira o endereço.'])
        setSubmitting(false)
        return
      }
      const geocoded = { ...found, source: 'endereco' as const }
      setCoordinates(geocoded)
      finalLocation = buildLocation({ ...addressFields, source: 'endereco' }, geocoded)
    }

    try {
      await onSubmit({
        customerId: customer.id,
        customerName: customer.name,
        desiredDate,
        location: finalLocation,
        price: selectedPrice,
        periodDays,
        details: details.trim(),
        notes: notes.trim(),
        attachmentName,
      })
      setSubmitted(true)
    } catch {
      toast.error('Não foi possível enviar a solicitação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <>
        <PageHeader eyebrow="Aluguel de caçamba" title="Solicitação enviada" description="A equipe JMF recebeu os dados e vai confirmar a disponibilidade." />
        <Card className="mx-auto max-w-2xl border-emerald-200 bg-emerald-50/70 shadow-none dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><CircleCheck aria-hidden="true" className="size-7" /></span>
            <h2 className="mt-5 text-xl font-semibold text-foreground">Pedido recebido com sucesso</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Você pode acompanhar cada etapa da entrega na sua área do cliente.</p>
            <Button className="mt-6 gap-2" onClick={onBack}>Acompanhar solicitação <ArrowRight data-icon="inline-end" /></Button>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader eyebrow="Nova locação" title="Alugar uma caçamba" description="Informe o local da obra e a data ideal. A equipe JMF confirma o agendamento." >
        <Button variant="outline" onClick={onBack} className="h-10 w-full sm:w-auto">Voltar</Button>
      </PageHeader>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <form onSubmit={handleSubmit} noValidate>
          <Card className="border-border/70 shadow-none">
            <CardHeader className="border-b border-border/70 pb-4">
              <CardTitle className="text-base">Dados da solicitação</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Preencha os dados de entrega para a equipe preparar o atendimento.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-5">
              {errors.length ? (
                <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {errors.map((error) => <p key={error}>{error}</p>)}
                </div>
              ) : null}
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>Agendamento</FieldLegend>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="rental-date">Data desejada</FieldLabel>
                      <Input id="rental-date" type="date" min={toDateInputValue()} value={desiredDate} onChange={(event) => setDesiredDate(event.target.value)} required />
                      <FieldDescription>O agendamento será confirmado pela equipe.</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel id="rental-period-label">Período do aluguel</FieldLabel>
                      <div role="radiogroup" aria-labelledby="rental-period-label" className="grid grid-cols-3 gap-2">
                        {availablePlans.map((plan) => (
                          <button
                            key={plan.days}
                            type="button"
                            role="radio"
                            aria-checked={periodDays === plan.days}
                            onClick={() => setPeriodDays(plan.days)}
                            className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${periodDays === plan.days ? 'border-primary bg-primary/8 text-primary dark:bg-primary/15' : 'border-border hover:bg-muted/60'}`}
                          >
                            <span className="block text-sm font-semibold">{plan.days} dias</span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatCurrency(plan.price)}</span>
                          </button>
                        ))}
                      </div>
                      <FieldDescription>Caçamba padrão. Se encher antes do fim, a troca gera um novo aluguel no mesmo período.</FieldDescription>
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSet>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <FieldLegend>Local da entrega</FieldLegend>
                      <FieldDescription>Informe o endereço completo ou envie sua localização atual.</FieldDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} disabled={locationLoading} className="h-9 gap-2 self-start sm:self-auto">
                      <Navigation data-icon="inline-start" />
                      {locationLoading ? 'Localizando...' : 'Usar minha localização'}
                    </Button>
                  </div>
                  {coordinates?.source === 'gps' ? (
                    <div role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300">
                      GPS: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                    </div>
                  ) : null}
                  <FieldGroup className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="rental-cep">CEP</FieldLabel>
                      <Input id="rental-cep" autoComplete="postal-code" inputMode="numeric" placeholder="65000-000" maxLength={9} value={postalCode} onChange={handleCepChange} aria-invalid={Boolean(errors.length && !addressComplete)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="rental-street">Rua</FieldLabel>
                      <Input id="rental-street" autoComplete="address-line1" placeholder="Nome da rua ou avenida" value={street} onChange={handleAddressChange(setStreet)} aria-invalid={Boolean(errors.length && !addressComplete)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="rental-number">Número</FieldLabel>
                      <Input id="rental-number" placeholder="Nº ou s/n" value={number} onChange={handleAddressChange(setNumber)} aria-invalid={Boolean(errors.length && !addressComplete)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="rental-neighborhood">Bairro</FieldLabel>
                      <Input id="rental-neighborhood" autoComplete="address-level3" placeholder="Bairro" value={neighborhood} onChange={handleAddressChange(setNeighborhood)} aria-invalid={Boolean(errors.length && !addressComplete)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="rental-complement">Complemento <span className="font-normal text-muted-foreground">(opcional)</span></FieldLabel>
                      <Input id="rental-complement" autoComplete="address-line2" placeholder="Referência, portão, lote..." value={complement} onChange={(event) => setComplement(event.target.value)} />
                    </Field>
                    <div className="grid grid-cols-[1fr_90px] gap-3">
                      <Field>
                        <FieldLabel htmlFor="rental-city">Cidade</FieldLabel>
                        <Input id="rental-city" autoComplete="address-level2" value={city} onChange={handleAddressChange(setCity)} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="rental-state">UF</FieldLabel>
                        <Input id="rental-state" autoComplete="address-level1" maxLength={2} value={state} onChange={handleAddressChange(setState)} />
                      </Field>
                    </div>
                  </FieldGroup>
                </FieldSet>

                <FieldSet>
                  <FieldLegend>Informações da obra</FieldLegend>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="rental-details">Detalhes da obra</FieldLabel>
                      <Textarea id="rental-details" rows={3} placeholder="Que tipo de resíduo será descartado? Conte um pouco sobre a obra." value={details} onChange={(event) => setDetails(event.target.value)} aria-invalid={Boolean(errors.length && details.trim().length < 4)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="rental-notes">Observações <span className="font-normal text-muted-foreground">(opcional)</span></FieldLabel>
                      <Textarea id="rental-notes" rows={2} placeholder="Acesso, horário preferencial ou referência do local." value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="rental-photo">Foto do local <span className="font-normal text-muted-foreground">(opcional)</span></FieldLabel>
                      <Input id="rental-photo" type="file" accept="image/*" onChange={(event) => setAttachmentName(event.target.files?.[0]?.name ?? '')} />
                      <FieldDescription>{attachmentName ? `Anexo selecionado: ${attachmentName}` : 'Uma foto ajuda a equipe a planejar o posicionamento.'}</FieldDescription>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>

              <div className="flex flex-col-reverse gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-xs leading-5 text-muted-foreground">Ao continuar, a equipe JMF vai revisar sua solicitação e confirmar o melhor horário de entrega.</p>
                <Button type="submit" disabled={submitting || availableCount === 0} className="h-11 shrink-0 gap-2 px-5">
                  {submitting ? 'Enviando...' : availableCount === 0 ? 'Sem caçambas disponíveis' : 'Enviar solicitação'}
                  {!submitting && availableCount > 0 ? <ArrowRight data-icon="inline-end" /> : null}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <div className="flex flex-col gap-4 xl:sticky xl:top-24">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Aluguel de caçamba</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Caçamba padrão · período de {periodDays} dias</p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/15"><Truck aria-hidden="true" className="size-5" /></span>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <PriceBlock price={selectedPrice} periodDays={periodDays} />
              <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
                <span className="text-muted-foreground">Caçambas disponíveis</span>
                <span className="font-semibold text-foreground">{availableCount} de 30</span>
              </div>
              {availableCount === 0 ? (
                <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
                  Não há caçambas disponíveis no momento. Entre em contato com a JMF para mais informações.
                </div>
              ) : null}
              <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
                <p className="flex items-start gap-2"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" /> O endereço é obrigatório para confirmar o posicionamento.</p>
                <p className="flex items-start gap-2"><Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /> O período contratado corresponde a 7 dias completos.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-border/70 shadow-none">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Ponto de entrega</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{location ? buildAddressLabel(location) : geocoding ? 'Localizando o endereço no mapa…' : 'Informe o CEP e o endereço, ou use sua localização, para ver o ponto no mapa.'}</p>
            </CardHeader>
            <CardContent className="pt-4">
              {location ? (
                <JmfMap points={mapPoints} height={230} className="overflow-hidden rounded-xl" />
              ) : (
                <div className="flex h-[230px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 text-center">
                  <MapPin aria-hidden="true" className="size-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Adicione o endereço para pré-visualizar o local.</p>
                </div>
              )}
              {location ? (
                <>
                  <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{location.street}, {location.number} · {location.neighborhood} · {location.city}/{location.state}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`, '_blank', 'noopener,noreferrer')} className="h-10 gap-2"><ArrowUpRight data-icon="inline-start" /> Abrir no Maps</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(`${location.street}, ${location.number}, ${location.city} - ${location.state}`)} className="h-10 gap-2"><MapPin data-icon="inline-start" /> Copiar endereço</Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function TimelineStep({
  label,
  date,
  state,
}: {
  label: string
  date?: string
  state: 'complete' | 'current' | 'upcoming'
}) {
  const complete = state === 'complete'
  const current = state === 'current'
  return (
    <li className="relative flex gap-4 pb-7 last:pb-0">
      <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-primary bg-primary text-primary-foreground' : current ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
        {complete ? <Check aria-hidden="true" className="size-4" /> : current ? <span className="size-2 rounded-full bg-primary" /> : <span className="size-2 rounded-full bg-muted-foreground/40" />}
      </span>
      <span className="min-w-0 pt-1">
        <span className={`block text-sm ${complete || current ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>{label}</span>
        {date ? <span className="mt-1 block text-xs text-muted-foreground">{formatDate(date)}</span> : null}
      </span>
      {state !== 'upcoming' ? <span className="absolute top-8 bottom-0 left-4 w-px bg-border last:hidden" /> : null}
    </li>
  )
}

export function ClientTrackingPage({
  customerId,
  currentDumpster,
  requests,
  onWhatsApp,
  onRent,
  onCreateSwap,
  onCreateRemoval,
}: {
  customerId: string
  currentDumpster?: Dumpster
  requests: RentalRequest[]
  onWhatsApp: () => void
  onRent: () => void
  onCreateSwap: () => Promise<void>
  onCreateRemoval: (reason: string, notes: string) => Promise<void>
}) {
  const [actionLoading, setActionLoading] = useState<'troca' | 'retirada' | null>(null)
  const location = currentDumpster?.location ?? requests.find((request) => request.customerId === customerId && !['finalizada', 'cancelada', 'rejeitada'].includes(request.status))?.location
  const mapsUrl = location ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}` : null

  const requestAction = async (action: 'troca' | 'retirada') => {
    setActionLoading(action)
    try {
      if (action === 'troca') await onCreateSwap()
      else await onCreateRemoval('Solicitação pelo acompanhamento', '')
    } finally {
      setActionLoading(null)
    }
  }

  const openMaps = () => {
    if (mapsUrl) window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }
  const customerRequests = requests.filter((request) => request.customerId === customerId)
  const activeRequest = customerRequests.find((request) => !['finalizada', 'cancelada', 'rejeitada'].includes(request.status))
  const activeStep = !currentDumpster
    ? activeRequest?.status === 'em_entrega' ? 2 : activeRequest?.status === 'aprovada' ? 1 : 0
    : 4
  const mapPoints = currentDumpster?.location
    ? [{
        id: currentDumpster.id,
        status: currentDumpster.status,
        customerName: currentDumpster.customerName,
        location: currentDumpster.location,
        rentalStartedAt: currentDumpster.rentalStartedAt,
      }]
    : []

  return (
    <>
      <PageHeader eyebrow="Área do cliente" title="Acompanhamento" description="Veja o andamento da sua solicitação e as atualizações da equipe JMF." >
        <Button variant="outline" onClick={onWhatsApp} className="h-10 w-full gap-2 sm:w-auto"><MessageCircle data-icon="inline-start" /> Falar com a JMF</Button>
      </PageHeader>
      {!currentDumpster && !activeRequest ? (
        <Card className="border-border/70 shadow-none"><EmptyState title="Você ainda não possui solicitações" description="Quando solicitar uma caçamba, o andamento aparecerá nesta página." action={<Button onClick={onRent}>Alugar caçamba</Button>} /></Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="border-b border-border/70 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{activeRequest ? `Solicitação ${activeRequest.id}` : 'Meu aluguel atual'}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{activeRequest ? REQUEST_TYPE_LABELS[activeRequest.type] : `Caçamba ${currentDumpster?.id}`}</p>
                </div>
                {activeRequest ? <StatusBadge status={activeRequest.status} /> : currentDumpster ? <StatusBadge status={currentDumpster.status} /> : null}
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <ol className="relative">
                <TimelineStep label="Solicitação realizada" date={activeRequest?.createdAt ?? currentDumpster?.rentalStartedAt} state={activeStep > 0 ? 'complete' : 'current'} />
                <TimelineStep label="Solicitação aprovada" state={activeStep > 1 ? 'complete' : activeStep === 1 ? 'current' : 'upcoming'} />
                <TimelineStep label="Caçamba em entrega" state={activeStep > 2 ? 'complete' : activeStep === 2 ? 'current' : 'upcoming'} />
                <TimelineStep label="Caçamba posicionada" date={currentDumpster?.rentalStartedAt} state={currentDumpster ? 'complete' : 'upcoming'} />
                <TimelineStep label="Em uso" state={currentDumpster ? 'current' : 'upcoming'} />
                <TimelineStep label="Retirada realizada" state="upcoming" />
              </ol>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-5">
            <Card className="border-border/70 shadow-none">
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Local da caçamba</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{currentDumpster?.location?.label ?? activeRequest?.location.label ?? 'Aguardando confirmação do endereço.'}</p>
                  </div>
                  <MapPin aria-hidden="true" className="size-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {mapPoints.length ? <JmfMap points={mapPoints} height={280} className="overflow-hidden rounded-xl" /> : (
                  <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">O mapa será exibido após a confirmação da entrega.</div>
                )}
                {location ? (
                  <>
                    <p className="mt-3 text-xs text-muted-foreground">{location.street}, {location.number} · {location.neighborhood} · {location.city}/{location.state}</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" onClick={openMaps} className="h-10 flex-1 gap-2" disabled={!mapsUrl}>
                        <ArrowUpRight data-icon="inline-start" /> Abrir no Maps
                      </Button>
                      <Button type="button" variant="outline" onClick={() => navigator.clipboard?.writeText(`${location.street}, ${location.number}, ${location.city} - ${location.state}`)} className="h-10 flex-1 gap-2">
                        <MapPin data-icon="inline-start" /> Copiar endereço
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
            {currentDumpster ? (
              <Card className="border-border/70 shadow-none">
                <CardHeader className="pb-0"><CardTitle className="text-base">Ações da locação</CardTitle><p className="mt-1 text-sm text-muted-foreground">Solicite uma troca ou combine a retirada sem sair do acompanhamento.</p></CardHeader>
                <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={() => requestAction('troca')} disabled={Boolean(actionLoading)} className="h-11 w-full justify-center gap-2"><RefreshCw data-icon="inline-start" />{actionLoading === 'troca' ? 'Enviando...' : 'Trocar caçamba'}</Button>
                  <Button type="button" variant="outline" onClick={() => requestAction('retirada')} disabled={Boolean(actionLoading)} className="h-11 w-full justify-center gap-2"><Truck data-icon="inline-start" />{actionLoading === 'retirada' ? 'Enviando...' : 'Solicitar retirada'}</Button>
                </CardContent>
              </Card>
            ) : null}
            <Card className="border-border/70 shadow-none">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/15"><Clock3 aria-hidden="true" className="size-5" /></span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Atualizações da locação</p>
                    <p className="mt-1 text-xs text-muted-foreground">A equipe JMF atualiza o status após cada etapa.</p>
                  </div>
                </div>
                <Button variant="outline" onClick={onWhatsApp} className="gap-2"><MessageCircle data-icon="inline-start" /> Contato via WhatsApp</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

export function ClientHistoryPage({
  customer,
  rentals,
  onRent,
}: {
  customer: JmfCustomer
  rentals: RentalRecord[]
  onRent: () => void
}) {
  const rows = rentals.filter((rental) => rental.customerId === customer.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  return (
    <>
      <PageHeader eyebrow="Área do cliente" title="Histórico de aluguéis" description="Consulte suas locações, trocas e valores registrados." >
        <Button onClick={onRent} className="gap-2"><Truck data-icon="inline-start" /> Novo aluguel</Button>
      </PageHeader>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Total de operações</p><p className="mt-2 text-2xl font-semibold">{rows.length}</p></CardContent></Card>
        <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Aluguel em andamento</p><p className="mt-2 text-2xl font-semibold">{rows.filter((row) => row.status === 'ativo').length}</p></CardContent></Card>
        <Card className="border-border/70 shadow-none"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Modelo contratado</p><p className="mt-2 text-2xl font-semibold">Padrão</p></CardContent></Card>
      </div>
      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-0"><CardTitle className="text-base">Todas as operações</CardTitle><p className="mt-1 text-sm text-muted-foreground">Cada troca de caçamba aparece como um novo aluguel.</p></CardHeader>
        <CardContent className="pt-4">
          {rows.length ? (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Operação</TableHead><TableHead>Caçamba</TableHead><TableHead>Data</TableHead><TableHead>Local</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((rental) => (
                      <TableRow key={rental.id}>
                        <TableCell><div><p className="font-medium text-foreground">{rental.operation === 'troca' ? `Novo aluguel (troca) · ${rental.periodDays} dias` : `Aluguel de ${rental.periodDays} dias`}</p><p className="mt-1 text-xs text-muted-foreground">{rental.id}</p></div></TableCell>
                        <TableCell className="font-semibold">{rental.dumpsterId}</TableCell>
                        <TableCell>{formatDate(rental.startedAt)}</TableCell>
                        <TableCell className="max-w-44 truncate">{rental.location.label}</TableCell>
                        <TableCell>{formatCurrency(rental.weeklyPrice)}</TableCell>
                        <TableCell><Badge variant={rental.status === 'ativo' ? 'default' : 'secondary'}>{rental.status === 'ativo' ? 'Em andamento' : 'Finalizado'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 md:hidden">
                {rows.map((rental) => (
                  <article key={rental.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{rental.dumpsterId} <span className="font-normal text-muted-foreground">· {rental.id}</span></p><p className="mt-1 text-xs text-muted-foreground">{rental.operation === 'troca' ? `Novo aluguel (troca) · ${rental.periodDays} dias` : `Aluguel de ${rental.periodDays} dias`}</p></div><Badge variant={rental.status === 'ativo' ? 'default' : 'secondary'}>{rental.status === 'ativo' ? 'Em andamento' : 'Finalizado'}</Badge></div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">Início</p><p className="mt-1 font-medium">{formatDate(rental.startedAt)}</p></div><div><p className="text-muted-foreground">Valor do período</p><p className="mt-1 font-medium">{formatCurrency(rental.weeklyPrice)}</p></div><div className="col-span-2"><p className="text-muted-foreground">Local</p><p className="mt-1 font-medium">{rental.location.label}</p></div></div>
                  </article>
                ))}
              </div>
            </>
          ) : <EmptyState title="Você ainda não possui aluguéis" description="Quando sua primeira solicitação for concluída, o histórico aparecerá aqui." action={<Button onClick={onRent}>Alugar caçamba</Button>} />}
        </CardContent>
      </Card>
    </>
  )
}

export interface ProfileUpdate {
  name: string
  phone: string
  cpf?: string
}

export function ClientProfilePage({
  customer,
  variant = 'cliente',
  onSave,
}: {
  customer: JmfCustomer
  variant?: 'cliente' | 'gestor'
  onSave?: (data: ProfileUpdate) => Promise<void>
}) {
  const isManager = variant === 'gestor'
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(maskPhone(customer.phone))
  const [cpf, setCpf] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const startEditing = () => {
    setName(customer.name)
    setPhone(maskPhone(customer.phone))
    setCpf('')
    setFormError(null)
    setEditing(true)
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim().length < 2) return setFormError('Informe seu nome completo.')
    if (!isValidPhone(phone)) return setFormError('Informe um telefone válido com DDD, ex.: (98) 98888-8888.')
    if (!isManager && cpf && !isValidCpf(cpf)) return setFormError('CPF inválido. Confira os números.')
    if (!onSave) return
    setSaving(true)
    setFormError(null)
    try {
      await onSave({ name: name.trim(), phone, cpf: !isManager && cpf ? cpf : undefined })
      setEditing(false)
    } catch {
      // a mensagem de erro já é exibida pelo app
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow={isManager ? 'Área do gestor' : 'Área do cliente'} title="Meu perfil" description={isManager ? 'Seus dados de acesso à operação da JMF.' : 'Seus dados de contato para solicitações e atualizações da JMF.'} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <Card className="border-border/70 shadow-none">
          <CardContent className="flex flex-col items-center px-6 py-8 text-center">
            <CustomerAvatar name={customer.name} initials={customer.initials} className="size-16 text-base" />
            <h2 className="mt-4 text-lg font-semibold">{customer.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{isManager ? 'Gestor JMF' : 'Cliente JMF'}</p>
            <Badge variant="secondary" className="mt-4 rounded-full">Cadastro ativo</Badge>
            {isManager ? null : (
              <div className="mt-6 grid w-full grid-cols-2 gap-3 border-t border-border/70 pt-5 text-left">
                <div><p className="text-xs text-muted-foreground">Aluguéis</p><p className="mt-1 text-lg font-semibold">{customer.totalRentals}</p></div>
                <div><p className="text-xs text-muted-foreground">Caçamba atual</p><p className="mt-1 text-lg font-semibold">{customer.currentDumpsterId ?? '—'}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <CardTitle className="text-base">Dados cadastrados</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Mantenha telefone e e-mail atualizados para receber avisos sobre o aluguel.</p>
            </div>
            {!editing && onSave ? <Button variant="outline" size="sm" onClick={startEditing} className="shrink-0 gap-1.5"><Pencil data-icon="inline-start" />Editar</Button> : null}
          </CardHeader>
          {editing ? (
            <CardContent className="pt-5">
              <form onSubmit={handleSave} className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="profile-name">Nome completo</FieldLabel>
                  <Input id="profile-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="profile-phone">Telefone</FieldLabel>
                  <Input id="profile-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(98) 98888-8888" value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} maxLength={15} required />
                </Field>
                {isManager ? null : (
                  <Field>
                    <FieldLabel htmlFor="profile-cpf">CPF <span className="font-normal text-muted-foreground">(opcional)</span></FieldLabel>
                    <Input id="profile-cpf" inputMode="numeric" placeholder={customer.cpf || '000.000.000-00'} value={cpf} onChange={(event) => setCpf(maskCpf(event.target.value))} maxLength={14} />
                    <FieldDescription>Deixe em branco para manter o atual.</FieldDescription>
                  </Field>
                )}
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="profile-email">E-mail</FieldLabel>
                  <Input id="profile-email" value={customer.email} readOnly aria-readonly="true" />
                  <FieldDescription>O e-mail é o seu login e não pode ser alterado aqui.</FieldDescription>
                </Field>
                {formError ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{formError}</p> : null}
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
                  <Button type="submit" disabled={saving} className="gap-1.5"><Save data-icon="inline-start" />{saving ? 'Salvando…' : 'Salvar alterações'}</Button>
                </div>
              </form>
            </CardContent>
          ) : (
            <CardContent className="grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-2">
              <div><p className="text-xs font-medium text-muted-foreground">Nome completo</p><p className="mt-1.5 text-sm font-medium">{customer.name}</p></div>
              {isManager ? null : <div><p className="text-xs font-medium text-muted-foreground">CPF</p><p className="mt-1.5 text-sm font-medium">{customer.cpf || 'Não informado'}</p></div>}
              <div><p className="text-xs font-medium text-muted-foreground">Telefone</p><p className="mt-1.5 text-sm font-medium">{customer.phone || <span className="text-destructive">Não informado — clique em Editar</span>}</p></div>
              <div><p className="text-xs font-medium text-muted-foreground">E-mail</p><p className="mt-1.5 text-sm font-medium">{customer.email}</p></div>
              <div className="sm:col-span-2"><div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /> Seus dados são utilizados para gerenciar solicitações e comunicações sobre locações.</div></div>
            </CardContent>
          )}
        </Card>
      </div>
    </>
  )
}
