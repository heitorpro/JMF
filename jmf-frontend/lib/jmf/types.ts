export type WorkspaceMode = 'cliente' | 'gestor'

export type PageKey =
  | 'dashboard'
  | 'alugar'
  | 'acompanhamento'
  | 'historico'
  | 'perfil'
  | 'solicitacoes'
  | 'cacambas'
  | 'estoque'
  | 'mapa'
  | 'clientes'
  | 'alugueis'
  | 'configuracoes'

export type DumpsterStatus = 'livre' | 'ocupada' | 'manutencao' | 'indisponivel'

export type RequestType = 'aluguel' | 'troca' | 'retirada'

export type RequestStatus =
  | 'pendente'
  | 'aprovada'
  | 'em_entrega'
  | 'entregue'
  | 'em_uso'
  | 'troca_solicitada'
  | 'em_troca'
  | 'retirada_solicitada'
  | 'em_retirada'
  | 'finalizada'
  | 'cancelada'
  | 'rejeitada'

export interface LocationAddress {
  postalCode: string
  street: string
  number: string
  neighborhood: string
  complement?: string
  city: string
  state: string
  latitude: number
  longitude: number
  label: string
  source?: 'endereco' | 'gps'
}

export interface JmfCustomer {
  id: string
  name: string
  initials: string
  cpf: string
  phone: string
  email: string
  currentDumpsterId?: string
  totalRentals: number
  status: 'ativo' | 'inativo'
}

export interface Dumpster {
  id: string
  number: number
  status: DumpsterStatus
  customerId?: string
  customerName?: string
  location?: LocationAddress
  rentalStartedAt?: string
  notes?: string
}

export interface RentalRequest {
  id: string
  type: RequestType
  status: RequestStatus
  customerId: string
  customerName: string
  dumpsterId?: string
  replacementDumpsterId?: string
  createdAt: string
  desiredDate: string
  location: LocationAddress
  price: number
  periodDays?: number
  reason?: string
  details?: string
  notes?: string
  attachmentName?: string
}

export interface RentalRecord {
  id: string
  customerId: string
  customerName: string
  dumpsterId: string
  startedAt: string
  endedAt?: string
  location: LocationAddress
  /** Valor do período contratado (7, 15 ou 30 dias). */
  weeklyPrice: number
  periodDays: number
  /** Fim previsto do período (AAAA-MM-DD). */
  endsAt?: string
  status: 'ativo' | 'encerrado'
  operation: 'locacao' | 'troca'
}

export interface RentalPlan {
  days: number
  price: number
}

export interface CompanySettings {
  weeklyPrice: number
  periodDays: number
  price15: number
  price30: number
  plans: RentalPlan[]
  whatsapp: string
  email: string
  phone: string
  address: string
}

export interface NotificationItem {
  id: string
  title: string
  description: string
  time: string
  read: boolean
  audience: WorkspaceMode | 'ambos'
}

export interface ActivityItem {
  id: string
  title: string
  description: string
  time: string
  kind: 'solicitacao' | 'entrega' | 'troca' | 'retirada' | 'estoque'
}

export interface RentalRequestInput {
  customerId: string
  customerName: string
  desiredDate: string
  location: LocationAddress
  price: number
  /** Plano escolhido: 7, 15 ou 30 dias. */
  periodDays?: number
  details: string
  notes?: string
  attachmentName?: string
}

export interface SwapRequestInput {
  customerId: string
  customerName: string
  dumpsterId: string
  desiredDate: string
  location: LocationAddress
  price: number
  reason: string
  notes?: string
}

export interface RemovalRequestInput {
  customerId: string
  customerName: string
  dumpsterId: string
  desiredDate: string
  location: LocationAddress
  reason: string
  notes?: string
}

export interface MapPoint {
  id: string
  status: DumpsterStatus
  customerName?: string
  location: LocationAddress
  requestId?: string
  rentalStartedAt?: string
}

export interface JmfService {
  createRentalRequest(input: RentalRequestInput): Promise<RentalRequest>
  createSwapRequest(input: SwapRequestInput): Promise<RentalRequest>
  createRemovalRequest(input: RemovalRequestInput): Promise<RentalRequest>
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  em_entrega: 'Em entrega',
  entregue: 'Entregue',
  em_uso: 'Em uso',
  troca_solicitada: 'Troca solicitada',
  em_troca: 'Em troca',
  retirada_solicitada: 'Retirada solicitada',
  em_retirada: 'Em retirada',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  rejeitada: 'Rejeitada',
}

export const DUMPSTER_STATUS_LABELS: Record<DumpsterStatus, string> = {
  livre: 'Livre',
  ocupada: 'Ocupada',
  manutencao: 'Em manutenção',
  indisponivel: 'Indisponível',
}

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  aluguel: 'Novo aluguel',
  troca: 'Troca de caçamba',
  retirada: 'Retirada',
}

export const REQUEST_STATUS_ORDER: RequestStatus[] = [
  'pendente',
  'aprovada',
  'em_entrega',
  'entregue',
  'em_uso',
  'troca_solicitada',
  'em_troca',
  'retirada_solicitada',
  'em_retirada',
  'finalizada',
  'cancelada',
  'rejeitada',
]

export const DUMPSTER_STATUS_ORDER: DumpsterStatus[] = [
  'livre',
  'ocupada',
  'manutencao',
  'indisponivel',
]

export function getLocationLabel(location: LocationAddress) {
  return `${location.neighborhood}, ${location.city} — ${location.state}`
}

export function getDumpsterLabel(dumpsterId?: string) {
  return dumpsterId ? `Caçamba ${dumpsterId}` : 'A definir'
}

export function isActiveRequestStatus(status: RequestStatus) {
  return !['finalizada', 'cancelada', 'rejeitada'].includes(status)
}

export function isAvailableDumpster(dumpster: Dumpster) {
  return dumpster.status === 'livre'
}

export function formatDumpsterNumber(number: number) {
  return `#${number.toString().padStart(3, '0')}`
}

/** Monta um endereço completo a partir do formulário e das coordenadas (GPS ou geocodificação). */
export function buildLocation(
  fields: Omit<LocationAddress, 'label' | 'latitude' | 'longitude'>,
  coordinates: { latitude: number; longitude: number },
): LocationAddress {
  return {
    ...fields,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    label: `${fields.neighborhood}, ${fields.city} — ${fields.state}`,
  }
}

export function isPendingRequestStatus(status: RequestStatus) {
  return [
    'pendente',
    'troca_solicitada',
    'retirada_solicitada',
  ].includes(status)
}

export function isReservedRequestStatus(status: RequestStatus) {
  return ['aprovada', 'em_entrega', 'entregue', 'em_uso', 'em_troca'].includes(status)
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
}

export function getNextRequestStatus(request: RentalRequest): RequestStatus | null {
  if (request.type === 'aluguel') {
    const nextStatus: Partial<Record<RequestStatus, RequestStatus>> = {
      pendente: 'aprovada',
      aprovada: 'em_entrega',
      em_entrega: 'entregue',
      entregue: 'em_uso',
    }
    return nextStatus[request.status] ?? null
  }

  if (request.type === 'retirada') {
    const nextStatus: Partial<Record<RequestStatus, RequestStatus>> = {
      retirada_solicitada: 'em_retirada',
      em_retirada: 'finalizada',
    }
    return nextStatus[request.status] ?? null
  }

  return null
}
