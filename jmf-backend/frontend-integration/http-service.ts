'use client'

/**
 * Substituto do `mockJmfService` (lib/jmf/service.ts) que chama o backend Java.
 * Copie para `lib/jmf/http-service.ts` no projeto Next.js e defina
 * NEXT_PUBLIC_JMF_API_URL (ex.: https://api.jmfentulhos.com.br).
 *
 * - Autenticação: JWT do Neon Auth obtido com `authClient.token()` e enviado como Bearer.
 * - O backend IGNORA/REJEITA customerId, customerName e price: dono e preço são definidos no servidor.
 * - Valores monetários chegam em centavos (`priceCents`) e são convertidos para reais aqui.
 */
import { authClient } from '@/lib/auth/client'
import type {
  JmfService,
  LocationAddress,
  RemovalRequestInput,
  RentalRequest,
  RentalRequestInput,
  SwapRequestInput,
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

// ---------------------------------------------------------------- mapeamento

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
  reason?: string
  details?: string
  notes?: string
  attachment?: { id: string; name: string }
}

const dumpsterLabel = (n?: number) => (n == null ? undefined : `#${String(n).padStart(3, '0')}`)

export function toRentalRequest(r: ApiRequest): RentalRequest {
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
    reason: r.reason,
    details: r.details,
    notes: r.notes,
    attachmentName: r.attachment?.name,
  }
}

const toLocationPayload = (l: LocationAddress) => ({
  postalCode: l.postalCode,
  street: l.street,
  number: l.number,
  neighborhood: l.neighborhood,
  complement: l.complement,
  city: l.city,
  state: l.state,
  latitude: l.latitude,
  longitude: l.longitude,
  source: l.source ?? 'endereco',
})

// ---------------------------------------------------------------- serviço

export const httpJmfService: JmfService = {
  async createRentalRequest(input: RentalRequestInput) {
    const created = await jmfFetch<ApiRequest>('/api/client/requests/rental', {
      method: 'POST',
      body: JSON.stringify({
        desiredDate: input.desiredDate.slice(0, 10),
        location: toLocationPayload(input.location),
        details: input.details,
        notes: input.notes,
        // attachmentId: obtido antes via POST /api/client/attachments (multipart)
      }),
    })
    return toRentalRequest(created)
  },

  async createSwapRequest(input: SwapRequestInput) {
    const created = await jmfFetch<ApiRequest>('/api/client/requests/swap', {
      method: 'POST',
      body: JSON.stringify({ desiredDate: input.desiredDate.slice(0, 10), reason: input.reason, notes: input.notes }),
    })
    return toRentalRequest(created)
  },

  async createRemovalRequest(input: RemovalRequestInput) {
    const created = await jmfFetch<ApiRequest>('/api/client/requests/removal', {
      method: 'POST',
      body: JSON.stringify({ desiredDate: input.desiredDate.slice(0, 10), reason: input.reason, notes: input.notes }),
    })
    return toRentalRequest(created)
  },
}

/** Após o cadastro no Neon Auth, persista o telefone informado no formulário. */
export async function saveProfilePhone(phone: string, name?: string) {
  return jmfFetch('/api/me', { method: 'PATCH', body: JSON.stringify({ phone, name }) })
}
