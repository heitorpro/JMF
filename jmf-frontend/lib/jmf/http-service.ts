'use client'

/**
 * Camada HTTP do frontend para o backend Java da JMF.
 * Copie para `lib/jmf/http-service.ts` no projeto Next.js e defina
 * NEXT_PUBLIC_JMF_API_URL (ex.: http://localhost:8080).
 *
 * - Autenticação: JWT do Neon Auth obtido com `authClient.token()` e enviado como Bearer.
 * - O backend IGNORA/REJEITA customerId, customerName e price: dono e preço são definidos no servidor.
 * - Valores monetários chegam em centavos e são convertidos para reais aqui.
 * - Os componentes usam rótulos legíveis como id ("#024" para caçambas, "JMF-2026-000001" para
 *   solicitações). Os UUIDs reais ficam guardados em mapas internos para as chamadas de API.
 */
import { authClient } from '@/lib/auth/client'
import type {
  ActivityItem,
  CompanySettings,
  Dumpster,
  DumpsterStatus,
  JmfCustomer,
  JmfService,
  LocationAddress,
  NotificationItem,
  RemovalRequestInput,
  RentalRecord,
  RentalRequest,
  RentalRequestInput,
  RequestStatus,
  SwapRequestInput,
  WorkspaceMode,
} from './types'

const API_URL = process.env.NEXT_PUBLIC_JMF_API_URL ?? 'http://localhost:8080'

export class JmfApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
    public readonly requestId?: string,
  ) {
    super(message)
  }
}

/** Mensagem amigável para exibir em toast, incluindo o primeiro erro de campo. */
export function apiErrorMessage(error: unknown, fallback = 'Não foi possível concluir a operação.') {
  if (error instanceof JmfApiError) {
    const firstField = error.fields ? Object.values(error.fields)[0] : undefined
    return firstField ?? error.message
  }
  return fallback
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 30_000 > Date.now()) return cachedToken.value
  const { data, error } = await authClient.token()
  if (error || !data?.token) throw new JmfApiError(401, 'UNAUTHENTICATED', 'Sessão expirada. Entre novamente.')
  const payload = JSON.parse(atob(data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  cachedToken = { value: data.token, expiresAt: (payload.exp ?? 0) * 1000 }
  return data.token
}

export async function jmfFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) cachedToken = null
    throw new JmfApiError(
      response.status,
      body?.error?.code ?? 'INTERNAL_ERROR',
      body?.error?.message ?? 'Não foi possível concluir a solicitação.',
      body?.error?.fields,
      body?.meta?.requestId,
    )
  }
  return body?.data as T
}

// ================================================================ tipos da API

interface Page<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

interface ApiLocation extends LocationAddress {
  id?: string
  mapsUrl?: string
}

interface ApiRequest {
  id: string
  protocol: string
  type: RentalRequest['type']
  status: RentalRequest['status']
  customerId: string
  customerName: string
  dumpsterId?: string
  dumpsterNumber?: number
  replacementDumpsterId?: string
  replacementDumpsterNumber?: number
  createdAt: string
  desiredDate: string
  location: ApiLocation
  priceCents: number
  periodDays: number
  reason?: string
  details?: string
  notes?: string
  attachment?: { id: string; name: string }
}

interface ApiDumpster {
  id: string
  number: number
  status: DumpsterStatus
  customerId?: string
  customerName?: string
  location?: ApiLocation
  rentalStartedAt?: string
  notes?: string
  reserved: boolean
}

interface ApiRental {
  id: string
  customerId: string
  customerName: string
  dumpsterId: string
  dumpsterNumber: number
  startedAt: string
  endedAt?: string
  location: ApiLocation
  weeklyPriceCents: number
  periodDays: number
  endsAt?: string
  status: RentalRecord['status']
  operation: RentalRecord['operation']
}

interface ApiCustomer {
  id: string
  name: string
  initials: string
  cpfMasked?: string
  phone?: string
  email: string
  status: JmfCustomer['status']
  totalRentals: number
  currentDumpsterNumbers: number[]
}

interface ApiNotification {
  id: string
  title: string
  description: string
  read: boolean
  createdAt: string
}

interface ApiPlan {
  days: number
  priceCents: number
}

interface ApiSettings {
  weeklyPriceCents: number
  periodDays: number
  price15Cents?: number
  price30Cents?: number
  plans?: ApiPlan[]
  whatsapp?: string
  email?: string
  phone?: string
  address?: string
}

export interface ApiMe {
  user: { id: string; name: string; email: string; phone?: string; role: 'cliente' | 'gestor'; permissions: string[] }
  customer: { id: string; name: string; cpfMasked?: string; phone?: string; email: string; status: JmfCustomer['status'] } | null
  profileComplete: boolean
}

interface ApiClientDashboard {
  customer: NonNullable<ApiMe['customer']>
  activeRentals: ApiRental[]
  totalRentals: number
  pricing: { weeklyPriceCents: number; periodDays: number; plans?: ApiPlan[] }
  contact: { whatsapp?: string; email?: string; phone?: string; address?: string }
  availableDumpsters?: number
}

interface ApiOverview {
  recentActivity: {
    id: string
    protocol?: string
    requestType?: RentalRequest['type']
    customerName?: string
    toStatus: RequestStatus
    title: string
    notes?: string
    createdAt: string
  }[]
}

// ================================================================ mapas rótulo → UUID

const requestUuidByLabel = new Map<string, string>()
/** Caçamba ("#003") → id do aluguel ativo do cliente, para troca/retirada do aluguel escolhido. */
const rentalUuidByDumpster = new Map<string, string>()
const dumpsterUuidByLabel = new Map<string, string>()

function requestUuid(label: string) {
  const id = requestUuidByLabel.get(label)
  if (!id) throw new JmfApiError(404, 'NOT_FOUND', 'Solicitação não encontrada. Atualize a página.')
  return id
}

function dumpsterUuid(label: string) {
  const id = dumpsterUuidByLabel.get(label)
  if (!id) throw new JmfApiError(404, 'NOT_FOUND', 'Caçamba não encontrada. Atualize a página.')
  return id
}

// ================================================================ conversões

export const dumpsterLabel = (n?: number) => (n == null ? undefined : `#${String(n).padStart(3, '0')}`)

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `Há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Há ${hours}h`
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value))
}

export function toRentalRequest(r: ApiRequest): RentalRequest {
  requestUuidByLabel.set(r.protocol, r.id)
  if (r.dumpsterId && r.dumpsterNumber != null) dumpsterUuidByLabel.set(dumpsterLabel(r.dumpsterNumber)!, r.dumpsterId)
  return {
    id: r.protocol,
    type: r.type,
    status: r.status,
    customerId: r.customerId,
    customerName: r.customerName,
    dumpsterId: dumpsterLabel(r.dumpsterNumber),
    replacementDumpsterId: dumpsterLabel(r.replacementDumpsterNumber),
    createdAt: r.createdAt,
    desiredDate: r.desiredDate,
    location: r.location,
    price: r.priceCents / 100,
    periodDays: r.periodDays ?? 7,
    reason: r.reason ?? undefined,
    details: r.details ?? undefined,
    notes: r.notes ?? undefined,
    attachmentName: r.attachment?.name,
  }
}

function toDumpster(d: ApiDumpster): Dumpster {
  const label = dumpsterLabel(d.number)!
  dumpsterUuidByLabel.set(label, d.id)
  return {
    id: label,
    number: d.number,
    status: d.status,
    customerId: d.customerId ?? undefined,
    customerName: d.customerName ?? undefined,
    location: d.location ?? undefined,
    rentalStartedAt: d.rentalStartedAt ?? undefined,
    notes: d.reserved ? ['Reservada para entrega', d.notes].filter(Boolean).join(' · ') : d.notes ?? undefined,
  }
}

function toRental(r: ApiRental): RentalRecord {
  return {
    id: `ALU-${r.id.slice(0, 8).toUpperCase()}`,
    customerId: r.customerId,
    customerName: r.customerName,
    dumpsterId: dumpsterLabel(r.dumpsterNumber)!,
    startedAt: r.startedAt,
    endedAt: r.endedAt ?? undefined,
    location: r.location,
    weeklyPrice: r.weeklyPriceCents / 100,
    periodDays: r.periodDays ?? 7,
    endsAt: r.endsAt ?? undefined,
    status: r.status,
    operation: r.operation,
  }
}

function toCustomer(c: ApiCustomer): JmfCustomer {
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    cpf: c.cpfMasked ?? '',
    phone: c.phone ?? '',
    email: c.email,
    currentDumpsterId: dumpsterLabel(c.currentDumpsterNumbers[0]),
    totalRentals: c.totalRentals,
    status: c.status,
  }
}

function toNotification(n: ApiNotification, audience: WorkspaceMode): NotificationItem {
  return { id: n.id, title: n.title, description: n.description, time: relativeTime(n.createdAt), read: n.read, audience }
}

function toSettings(s: { weeklyPriceCents: number; periodDays: number; price15Cents?: number; price30Cents?: number; plans?: ApiPlan[]; whatsapp?: string; email?: string; phone?: string; address?: string }): CompanySettings {
  const plans = (s.plans ?? [{ days: 7, priceCents: s.weeklyPriceCents }]).map((p) => ({ days: p.days, price: p.priceCents / 100 }))
  return {
    weeklyPrice: s.weeklyPriceCents / 100,
    periodDays: s.periodDays,
    price15: s.price15Cents != null ? s.price15Cents / 100 : plans.find((p) => p.days === 15)?.price ?? 0,
    price30: s.price30Cents != null ? s.price30Cents / 100 : plans.find((p) => p.days === 30)?.price ?? 0,
    plans,
    whatsapp: s.whatsapp ?? '',
    email: s.email ?? '',
    phone: s.phone ?? '',
    address: s.address ?? '',
  }
}

function activityKind(type: RentalRequest['type'] | undefined, status: RequestStatus): ActivityItem['kind'] {
  if (status === 'em_entrega' || status === 'entregue') return 'entrega'
  if (type === 'troca') return 'troca'
  if (type === 'retirada') return 'retirada'
  return 'solicitacao'
}

const toLocationPayload = (l: LocationAddress) => ({
  postalCode: l.postalCode || undefined,
  street: l.street,
  number: l.number,
  neighborhood: l.neighborhood,
  complement: l.complement || undefined,
  city: l.city,
  state: l.state,
  latitude: l.latitude,
  longitude: l.longitude,
  source: l.source ?? 'endereco',
})

/** Ignora 403 (gestor sem a permissão daquela tela) devolvendo lista vazia. */
async function optional<T>(promise: Promise<T>, empty: T): Promise<T> {
  try {
    return await promise
  } catch (error) {
    if (error instanceof JmfApiError && error.status === 403) return empty
    throw error
  }
}

const emptyPage = <T,>(): Page<T> => ({ items: [], page: 0, size: 0, totalItems: 0, totalPages: 0 })

// ================================================================ carregamento de dados

export interface JmfSnapshot {
  customer?: JmfCustomer
  dumpsters: Dumpster[]
  requests: RentalRequest[]
  rentals: RentalRecord[]
  customers: JmfCustomer[]
  notifications: NotificationItem[]
  activities: ActivityItem[]
  settings: CompanySettings
  /** Somente cliente: caçambas livres e sem reserva. */
  availableDumpsters?: number
}

export function fetchMe() {
  return jmfFetch<ApiMe>('/api/me')
}

export async function loadClientData(): Promise<JmfSnapshot> {
  const [dashboard, requests, rentals, notifications] = await Promise.all([
    jmfFetch<ApiClientDashboard>('/api/client/dashboard'),
    jmfFetch<Page<ApiRequest>>('/api/client/requests?size=100'),
    jmfFetch<Page<ApiRental>>('/api/client/rentals?size=100'),
    jmfFetch<Page<ApiNotification>>('/api/me/notifications?size=50'),
  ])
  const active = dashboard.activeRentals
  const customer: JmfCustomer = {
    id: dashboard.customer.id,
    name: dashboard.customer.name,
    initials: dashboard.customer.name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
    cpf: dashboard.customer.cpfMasked ?? '',
    phone: dashboard.customer.phone ?? '',
    email: dashboard.customer.email,
    currentDumpsterId: dumpsterLabel(active[0]?.dumpsterNumber),
    totalRentals: dashboard.totalRentals,
    status: dashboard.customer.status,
  }
  rentalUuidByDumpster.clear()
  for (const r of active) {
    const label = dumpsterLabel(r.dumpsterNumber)
    if (label) rentalUuidByDumpster.set(label, r.id)
  }
  // O cliente não acessa a frota: as "caçambas" dele são as das locações ativas.
  const dumpsters: Dumpster[] = active.map((r) => ({
    id: dumpsterLabel(r.dumpsterNumber)!,
    number: r.dumpsterNumber,
    status: 'ocupada',
    customerId: r.customerId,
    customerName: r.customerName,
    location: r.location,
    rentalStartedAt: r.startedAt,
  }))
  return {
    customer,
    dumpsters,
    requests: requests.items.map(toRentalRequest),
    rentals: rentals.items.map(toRental),
    customers: [customer],
    notifications: notifications.items.map((n) => toNotification(n, 'cliente')),
    activities: [],
    settings: toSettings({ ...dashboard.pricing, ...dashboard.contact }),
    availableDumpsters: dashboard.availableDumpsters,
  }
}

export async function loadManagerData(): Promise<JmfSnapshot> {
  const [requests, dumpsters, customers, rentals, notifications, settings, overview] = await Promise.all([
    jmfFetch<Page<ApiRequest>>('/api/manager/requests?size=100'),
    jmfFetch<Page<ApiDumpster>>('/api/manager/dumpsters?size=100'),
    optional(jmfFetch<Page<ApiCustomer>>('/api/manager/customers?size=100'), emptyPage<ApiCustomer>()),
    optional(jmfFetch<Page<ApiRental>>('/api/manager/rentals?size=100'), emptyPage<ApiRental>()),
    jmfFetch<Page<ApiNotification>>('/api/me/notifications?size=50'),
    jmfFetch<ApiSettings>('/api/manager/settings'),
    jmfFetch<ApiOverview>('/api/manager/overview'),
  ])
  return {
    dumpsters: dumpsters.items.map(toDumpster),
    requests: requests.items.map(toRentalRequest),
    rentals: rentals.items.map(toRental),
    customers: customers.items.map(toCustomer),
    notifications: notifications.items.map((n) => toNotification(n, 'gestor')),
    activities: overview.recentActivity.map((a) => ({
      id: a.id,
      title: a.title,
      description: [a.protocol, a.customerName, a.notes].filter(Boolean).join(' · '),
      time: relativeTime(a.createdAt),
      kind: activityKind(a.requestType, a.toStatus),
    })),
    settings: toSettings(settings),
  }
}

// ================================================================ ações do cliente

export const httpJmfService: JmfService = {
  async createRentalRequest(input: RentalRequestInput) {
    const created = await jmfFetch<ApiRequest>('/api/client/requests/rental', {
      method: 'POST',
      body: JSON.stringify({
        desiredDate: input.desiredDate.slice(0, 10),
        location: toLocationPayload(input.location),
        details: input.details,
        notes: input.notes || undefined,
        periodDays: input.periodDays ?? 7,
      }),
    })
    return toRentalRequest(created)
  },

  async createSwapRequest(input: SwapRequestInput) {
    const created = await jmfFetch<ApiRequest>('/api/client/requests/swap', {
      method: 'POST',
      body: JSON.stringify({ rentalId: rentalUuidByDumpster.get(input.dumpsterId), desiredDate: input.desiredDate.slice(0, 10), reason: input.reason, notes: input.notes || undefined }),
    })
    return toRentalRequest(created)
  },

  async createRemovalRequest(input: RemovalRequestInput) {
    const created = await jmfFetch<ApiRequest>('/api/client/requests/removal', {
      method: 'POST',
      body: JSON.stringify({ rentalId: rentalUuidByDumpster.get(input.dumpsterId), desiredDate: input.desiredDate.slice(0, 10), reason: input.reason, notes: input.notes || undefined }),
    })
    return toRentalRequest(created)
  },
}

/** Atualiza os dados do perfil (nome, telefone e, para clientes, CPF). */
export function updateProfile(data: { name?: string; phone?: string; cpf?: string }) {
  return jmfFetch<ApiMe>('/api/me', { method: 'PATCH', body: JSON.stringify(data) })
}

/** Versão dos dados no servidor: muda quando algo muda (consulta leve para atualização rápida). */
export async function fetchSyncVersion(): Promise<string> {
  const result = await jmfFetch<{ version: string }>('/api/me/sync')
  return result.version
}

/** Telefone/nome do cadastro ainda não confirmados pelo servidor (localStorage). */
export const PENDING_PROFILE_KEY = 'jmf.pendingProfile'

/** Após o cadastro no Neon Auth, persista o telefone informado no formulário. */
export async function saveProfilePhone(phone: string, name?: string) {
  return jmfFetch('/api/me', { method: 'PATCH', body: JSON.stringify({ phone, name: name || undefined }) })
}

// ================================================================ ações do gestor

export function changeRequestStatus(requestLabel: string, status: RequestStatus, sendToMaintenance = false) {
  return jmfFetch<ApiRequest>(`/api/manager/requests/${requestUuid(requestLabel)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, sendToMaintenance }),
  }).then(toRentalRequest)
}

export function completeSwap(requestLabel: string, replacementDumpsterLabel: string) {
  return jmfFetch<ApiRequest>(`/api/manager/requests/${requestUuid(requestLabel)}/complete-swap`, {
    method: 'POST',
    body: JSON.stringify({ replacementDumpsterId: dumpsterUuid(replacementDumpsterLabel), sendOldToMaintenance: false }),
  }).then(toRentalRequest)
}

export function updateDumpsterStatus(dumpsterLabelValue: string, status: DumpsterStatus) {
  return jmfFetch(`/api/manager/dumpsters/${dumpsterUuid(dumpsterLabelValue)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function saveSettings(settings: CompanySettings) {
  return jmfFetch<ApiSettings>('/api/manager/settings', {
    method: 'PATCH',
    body: JSON.stringify({
      weeklyPriceCents: Math.round(settings.weeklyPrice * 100),
      periodDays: settings.periodDays,
      price15Cents: Math.round(settings.price15 * 100),
      price30Cents: Math.round(settings.price30 * 100),
      whatsapp: settings.whatsapp,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
    }),
  }).then(toSettings)
}

export function markNotificationRead(id: string) {
  return jmfFetch(`/api/me/notifications/${id}/read`, { method: 'PATCH' })
}
