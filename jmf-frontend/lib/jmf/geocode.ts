'use client'

/**
 * Localização do endereço da obra — atendimento somente em São Luís — MA.
 *
 * - Endereço → mapa: Nominatim (OpenStreetMap), limitado à área de São Luís.
 * - Busca de locais/pontos de referência ("Shopping Rio Anil", "Posto Natureza Turu"):
 *   Photon (feito para busca enquanto digita) com o Nominatim como reserva.
 * - Mapa → endereço (GPS ou marcador): Nominatim reverse.
 * - CEP → endereço: ViaCEP.
 * Todos são públicos e sem chave; as chamadas têm atraso (debounce) para respeitar os limites de uso.
 */

export const SERVICE_CITY = 'São Luís'
export const SERVICE_STATE = 'MA'
export const SAO_LUIS_CENTER = { latitude: -2.5297, longitude: -44.3028 }

// Área do município de São Luís (ilha): oeste, norte, leste, sul.
const BOX = { west: -44.45, north: -2.42, east: -44.12, south: -2.80 }
const NOMINATIM_VIEWBOX = `${BOX.west},${BOX.north},${BOX.east},${BOX.south}`
const PHOTON_BBOX = `${BOX.west},${BOX.south},${BOX.east},${BOX.north}`

export function insideServiceArea(latitude: number, longitude: number) {
  return latitude <= BOX.north && latitude >= BOX.south && longitude >= BOX.west && longitude <= BOX.east
}

/** exato: rua + número; rua: só a rua; bairro: centro do bairro. */
export type GeocodePrecision = 'exato' | 'rua' | 'bairro'

export interface GeocodeResult {
  latitude: number
  longitude: number
  precision: GeocodePrecision
}

async function nominatimSearch(q: string, limit = 1) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&countrycodes=br&bounded=1&viewbox=${NOMINATIM_VIEWBOX}&q=${encodeURIComponent(q)}`
  const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
  if (!response.ok) return []
  return (await response.json()) as NominatimPlace[]
}

interface NominatimPlace {
  lat: string
  lon: string
  name?: string
  display_name?: string
  address?: Record<string, string>
}

/** Endereço digitado → coordenadas, do mais preciso ao aproximado. */
export async function geocodeAddress(address: {
  street: string
  number: string
  neighborhood: string
}): Promise<GeocodeResult | null> {
  const street = address.street.trim()
  const number = address.number.trim().toUpperCase() === 'S/N' ? '' : address.number.trim()
  const neighborhood = address.neighborhood.trim()
  const attempts: [string, GeocodePrecision][] = []
  if (street && number) attempts.push([`${street}, ${number}, ${neighborhood ? `${neighborhood}, ` : ''}${SERVICE_CITY}`, 'exato'])
  if (street && neighborhood) attempts.push([`${street}, ${neighborhood}, ${SERVICE_CITY}`, 'rua'])
  if (street) attempts.push([`${street}, ${SERVICE_CITY}`, 'rua'])
  if (neighborhood) attempts.push([`${neighborhood}, ${SERVICE_CITY}`, 'bairro'])
  for (const [q, precision] of attempts) {
    try {
      const [first] = await nominatimSearch(q)
      if (first) return { latitude: Number(first.lat), longitude: Number(first.lon), precision }
    } catch {
      // tenta a próxima consulta
    }
  }
  return null
}

export interface ResolvedAddress {
  postalCode: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
}

function fromNominatimAddress(a: Record<string, string>): Partial<ResolvedAddress> {
  return {
    postalCode: (a.postcode ?? '').replace(/\D/g, ''),
    street: a.road ?? a.pedestrian ?? a.residential ?? a.footway ?? '',
    number: a.house_number ?? '',
    neighborhood: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? '',
  }
}

/** Coordenadas → endereço (GPS ou marcador movido no mapa). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<Partial<ResolvedAddress> | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`
    const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
    if (!response.ok) return null
    const data = (await response.json()) as { address?: Record<string, string> }
    return data.address ? fromNominatimAddress(data.address) : null
  } catch {
    return null
  }
}

/** CEP → endereço (ViaCEP). Só aceita CEP de São Luís. */
export async function lookupCep(cep: string): Promise<(Partial<ResolvedAddress> & { outsideCity?: boolean }) | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!response.ok) return null
    const data = (await response.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (data.erro) return null
    const outsideCity = data.uf !== SERVICE_STATE || !/s[aã]o lu[ií]s/i.test(data.localidade ?? '')
    return { postalCode: digits, street: data.logradouro ?? '', neighborhood: data.bairro ?? '', outsideCity }
  } catch {
    return null
  }
}

/** Sugestão de local para a busca por nome (shopping, posto, escola, rua…). */
export interface PlaceSuggestion {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
  street: string
  number: string
  neighborhood: string
  postalCode: string
  /** true quando é um estabelecimento/ponto (não apenas uma rua). */
  landmark: boolean
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_id?: number
    osm_key?: string
    osm_value?: string
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    district?: string
    locality?: string
    city?: string
    state?: string
  }
}

async function photonSearch(query: string): Promise<PlaceSuggestion[]> {
  const url = `https://photon.komoot.io/api/?limit=8&lat=${SAO_LUIS_CENTER.latitude}&lon=${SAO_LUIS_CENTER.longitude}&bbox=${PHOTON_BBOX}&q=${encodeURIComponent(query)}`
  const response = await fetch(url)
  if (!response.ok) return []
  const data = (await response.json()) as { features?: PhotonFeature[] }
  return (data.features ?? []).map((f, index) => {
    const p = f.properties
    const [longitude, latitude] = f.geometry.coordinates
    const isStreet = p.osm_key === 'highway'
    const neighborhood = p.district ?? p.locality ?? ''
    const name = p.name ?? p.street ?? 'Local'
    const street = isStreet ? (p.name ?? '') : (p.street ?? '')
    return {
      id: `p${p.osm_id ?? index}`,
      name,
      description: [street && street !== name ? `${street}${p.housenumber ? `, ${p.housenumber}` : ''}` : '', neighborhood, p.city ?? SERVICE_CITY].filter(Boolean).join(' · '),
      latitude,
      longitude,
      street,
      number: p.housenumber ?? '',
      neighborhood,
      postalCode: (p.postcode ?? '').replace(/\D/g, ''),
      landmark: !isStreet,
    }
  })
}

async function nominatimPlaces(query: string): Promise<PlaceSuggestion[]> {
  const results = await nominatimSearch(`${query}, ${SERVICE_CITY}`, 6)
  return results.map((r, index) => {
    const a = fromNominatimAddress(r.address ?? {})
    const name = r.name || a.street || 'Local'
    return {
      id: `n${index}-${r.lat}`,
      name,
      description: [a.street && a.street !== name ? a.street : '', a.neighborhood, SERVICE_CITY].filter(Boolean).join(' · '),
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      street: a.street ?? '',
      number: a.number ?? '',
      neighborhood: a.neighborhood ?? '',
      postalCode: a.postalCode ?? '',
      landmark: Boolean(r.name && r.name !== a.street),
    }
  })
}

/** Busca locais em São Luís pelo nome — ex.: "Shopping Rio Anil", "Posto Natureza Turu". */
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []
  let results: PlaceSuggestion[] = []
  try {
    results = await photonSearch(q)
  } catch {
    results = []
  }
  if (!results.length) {
    try {
      results = await nominatimPlaces(q)
    } catch {
      results = []
    }
  }
  return results.filter((r) => insideServiceArea(r.latitude, r.longitude))
}
