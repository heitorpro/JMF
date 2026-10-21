'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Localização do endereço da obra — atendimento somente em São Luís — MA.
 *
 * Provedor principal: Google Maps (Places para a busca por nome, Geocoding para endereço ↔ coordenadas),
 * ativado por NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Sem chave, ou se o Google falhar, usa o OpenStreetMap
 * (Photon/Nominatim). CEP → endereço continua no ViaCEP.
 */

import { googleMapsEnabled, importGoogleLibrary } from './google-maps'

export const SERVICE_CITY = 'São Luís'
export const SERVICE_STATE = 'MA'
export const SAO_LUIS_CENTER = { latitude: -2.5297, longitude: -44.3028 }

// Área do município de São Luís (ilha).
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

export interface ResolvedAddress {
  postalCode: string
  street: string
  number: string
  neighborhood: string
}

export interface PlaceDetails extends Partial<ResolvedAddress> {
  latitude: number
  longitude: number
}

/** Sugestão da busca por nome (shopping, posto, escola, rua…). As coordenadas vêm em resolve(). */
export interface PlaceSuggestion {
  id: string
  name: string
  description: string
  /** true quando é um estabelecimento/ponto (não apenas uma rua). */
  landmark: boolean
  resolve: () => Promise<PlaceDetails | null>
}

/** Usa o Google quando configurado; em caso de erro (rede, cota, chave), cai para o OpenStreetMap. */
async function withFallback<T>(google: () => Promise<T>, osm: () => Promise<T>): Promise<T> {
  if (googleMapsEnabled()) {
    try {
      return await google()
    } catch (error) {
      console.warn('Google Maps indisponível; usando OpenStreetMap.', error)
    }
  }
  return osm()
}

// =============================================================== Google

interface GoogleComponent {
  long_name?: string
  short_name?: string
  longText?: string
  shortText?: string
  types: string[]
}

function fromGoogleComponents(components: GoogleComponent[] = []): ResolvedAddress {
  const get = (...types: string[]) => {
    for (const type of types) {
      const c = components.find((item) => item.types.includes(type))
      if (c) return c.long_name ?? c.longText ?? ''
    }
    return ''
  }
  return {
    street: get('route'),
    number: get('street_number'),
    neighborhood: get('sublocality_level_1', 'sublocality', 'neighborhood'),
    postalCode: get('postal_code').replace(/\D/g, ''),
  }
}

let geocoder: any = null
async function googleGeocoder() {
  if (!geocoder) {
    const { Geocoder } = await importGoogleLibrary('geocoding')
    geocoder = new Geocoder()
  }
  return geocoder
}

async function googleGeocode(address: { street: string; number: string; neighborhood: string }): Promise<GeocodeResult | null> {
  const g = await googleGeocoder()
  const streetPart = [address.street, address.number].filter(Boolean).join(', ')
  const query = `${[streetPart, address.neighborhood].filter(Boolean).join(' - ')}, ${SERVICE_CITY} - ${SERVICE_STATE}, Brasil`
  let results: any[] = []
  try {
    ;({ results } = await g.geocode({
      address: query,
      bounds: BOX,
      componentRestrictions: { country: 'BR', administrativeArea: SERVICE_STATE },
      region: 'br',
    }))
  } catch (error: any) {
    if (error?.code === 'ZERO_RESULTS') return null
    throw error
  }
  const found = results.find((r) => insideServiceArea(r.geometry.location.lat(), r.geometry.location.lng()))
  if (!found) return null
  const types: string[] = found.types ?? []
  // Resultado que é só "São Luís" (centro da cidade) não ajuda a localizar a obra.
  if (types.includes('locality') || types.includes('administrative_area_level_2')) return null
  const exact = ['ROOFTOP', 'RANGE_INTERPOLATED'].includes(found.geometry.location_type) && Boolean(address.number)
  const precision: GeocodePrecision = exact ? 'exato' : types.includes('route') || types.includes('street_address') || types.includes('premise') ? 'rua' : 'bairro'
  return { latitude: found.geometry.location.lat(), longitude: found.geometry.location.lng(), precision }
}

async function googleReverse(latitude: number, longitude: number): Promise<Partial<ResolvedAddress> | null> {
  const g = await googleGeocoder()
  const { results } = await g.geocode({ location: { lat: latitude, lng: longitude } })
  const best = results.find((r: any) => (r.address_components ?? []).some((c: GoogleComponent) => c.types.includes('route'))) ?? results[0]
  return best ? fromGoogleComponents(best.address_components) : null
}

let sessionToken: any = null

async function googleSearch(query: string): Promise<PlaceSuggestion[]> {
  const { AutocompleteSuggestion, AutocompleteSessionToken } = await importGoogleLibrary('places')
  // O token agrupa digitação + escolha numa única "sessão" de cobrança do Google.
  if (!sessionToken) sessionToken = new AutocompleteSessionToken()
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: query,
    sessionToken,
    locationRestriction: BOX,
    includedRegionCodes: ['br'],
    language: 'pt-BR',
    region: 'br',
  })
  return (suggestions as any[])
    .filter((s) => s.placePrediction)
    .slice(0, 8)
    .map((s) => {
      const p = s.placePrediction
      const types: string[] = p.types ?? []
      return {
        id: p.placeId,
        name: p.mainText?.text ?? p.text?.text ?? 'Local',
        description: (p.secondaryText?.text ?? '').replace(/, Brasil$|, Brazil$/, ''),
        landmark: !types.includes('route') && !types.includes('street_address'),
        resolve: async () => {
          const place = p.toPlace()
          await place.fetchFields({ fields: ['location', 'addressComponents'] })
          sessionToken = null
          if (!place.location) return null
          return {
            latitude: place.location.lat(),
            longitude: place.location.lng(),
            ...fromGoogleComponents(place.addressComponents),
          }
        },
      }
    })
}

// =============================================================== OpenStreetMap (reserva)

interface NominatimPlace {
  lat: string
  lon: string
  name?: string
  address?: Record<string, string>
}

async function nominatimSearch(q: string, limit = 1) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&countrycodes=br&bounded=1&viewbox=${NOMINATIM_VIEWBOX}&q=${encodeURIComponent(q)}`
  const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
  if (!response.ok) return []
  return (await response.json()) as NominatimPlace[]
}

function fromNominatimAddress(a: Record<string, string>): ResolvedAddress {
  return {
    postalCode: (a.postcode ?? '').replace(/\D/g, ''),
    street: a.road ?? a.pedestrian ?? a.residential ?? a.footway ?? '',
    number: a.house_number ?? '',
    neighborhood: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? '',
  }
}

async function osmGeocode(address: { street: string; number: string; neighborhood: string }): Promise<GeocodeResult | null> {
  const { street, number, neighborhood } = address
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

async function osmReverse(latitude: number, longitude: number): Promise<Partial<ResolvedAddress> | null> {
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

function detailsNow(d: PlaceDetails) {
  return async () => d
}

async function osmSearch(query: string): Promise<PlaceSuggestion[]> {
  let results: PlaceSuggestion[] = []
  try {
    const url = `https://photon.komoot.io/api/?limit=8&lat=${SAO_LUIS_CENTER.latitude}&lon=${SAO_LUIS_CENTER.longitude}&bbox=${PHOTON_BBOX}&q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    const data = response.ok ? ((await response.json()) as { features?: any[] }) : { features: [] }
    results = (data.features ?? []).map((f, index) => {
      const p = f.properties ?? {}
      const [longitude, latitude] = f.geometry.coordinates as [number, number]
      const isStreet = p.osm_key === 'highway'
      const neighborhood = p.district ?? p.locality ?? ''
      const name = p.name ?? p.street ?? 'Local'
      const street = isStreet ? (p.name ?? '') : (p.street ?? '')
      return {
        id: `p${p.osm_id ?? index}`,
        name,
        description: [street && street !== name ? street : '', neighborhood, SERVICE_CITY].filter(Boolean).join(' · '),
        landmark: !isStreet,
        resolve: detailsNow({ latitude, longitude, street, number: p.housenumber ?? '', neighborhood, postalCode: (p.postcode ?? '').replace(/\D/g, '') }),
        _lat: latitude,
        _lng: longitude,
      }
    }).filter((r: any) => insideServiceArea(r._lat, r._lng))
  } catch {
    results = []
  }
  if (results.length) return results
  const places = await nominatimSearch(`${query}, ${SERVICE_CITY}`, 6)
  return places.map((r, index) => {
    const a = fromNominatimAddress(r.address ?? {})
    const name = r.name || a.street || 'Local'
    return {
      id: `n${index}-${r.lat}`,
      name,
      description: [a.street && a.street !== name ? a.street : '', a.neighborhood, SERVICE_CITY].filter(Boolean).join(' · '),
      landmark: Boolean(r.name && r.name !== a.street),
      resolve: detailsNow({ latitude: Number(r.lat), longitude: Number(r.lon), ...a }),
    }
  })
}

// =============================================================== API usada pelas telas

/** Endereço digitado → coordenadas, do mais preciso ao aproximado. */
export async function geocodeAddress(address: { street: string; number: string; neighborhood: string }): Promise<GeocodeResult | null> {
  const clean = {
    street: address.street.trim(),
    number: address.number.trim().toUpperCase() === 'S/N' ? '' : address.number.trim(),
    neighborhood: address.neighborhood.trim(),
  }
  if (!clean.street && !clean.neighborhood) return null
  const result = await withFallback(() => googleGeocode(clean), () => osmGeocode(clean))
  return result && insideServiceArea(result.latitude, result.longitude) ? result : null
}

/** Coordenadas → endereço (GPS ou marcador movido no mapa). */
export function reverseGeocode(latitude: number, longitude: number): Promise<Partial<ResolvedAddress> | null> {
  return withFallback(() => googleReverse(latitude, longitude), () => osmReverse(latitude, longitude))
}

/** Busca locais em São Luís pelo nome — ex.: "Shopping Rio Anil", "Posto Natureza Turu". */
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []
  return withFallback(() => googleSearch(q), () => osmSearch(q))
}

/** CEP → endereço (ViaCEP). Indica quando o CEP não é de São Luís. */
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
