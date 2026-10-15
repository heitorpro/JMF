'use client'

/**
 * Geocodificação do endereço digitado quando o cliente não usa o GPS.
 * Usa o Nominatim (OpenStreetMap), público e sem chave. Para volume maior,
 * configure um provedor no backend (GeocodingProvider) e troque esta chamada
 * por POST /api/client/locations/resolve.
 */
export async function geocodeAddress(address: {
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  postalCode: string
}): Promise<{ latitude: number; longitude: number } | null> {
  const queries = [
    `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}, ${address.state}, Brasil`,
    `${address.street}, ${address.city}, ${address.state}, Brasil`,
    `${address.postalCode.replace(/\D/g, '')}, ${address.city}, Brasil`,
  ]
  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`
      const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
      if (!response.ok) continue
      const results = (await response.json()) as { lat: string; lon: string }[]
      if (results[0]) {
        return { latitude: Number(results[0].lat), longitude: Number(results[0].lon) }
      }
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

/** Coordenadas → endereço (usado após "Usar minha localização"). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<Partial<ResolvedAddress> | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`
    const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
    if (!response.ok) return null
    const data = (await response.json()) as { address?: Record<string, string> }
    const a = data.address
    if (!a) return null
    const uf = (a['ISO3166-2-lvl4'] ?? '').replace(/^BR-/, '')
    return {
      postalCode: (a.postcode ?? '').replace(/\D/g, ''),
      street: a.road ?? a.pedestrian ?? a.residential ?? '',
      number: a.house_number ?? '',
      neighborhood: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? '',
      city: a.city ?? a.town ?? a.municipality ?? a.village ?? '',
      state: uf.length === 2 ? uf : '',
    }
  } catch {
    return null
  }
}

/** CEP → endereço (ViaCEP, público e gratuito). */
export async function lookupCep(cep: string): Promise<Partial<ResolvedAddress> | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!response.ok) return null
    const data = (await response.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (data.erro) return null
    return {
      postalCode: digits,
      street: data.logradouro ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
    }
  } catch {
    return null
  }
}
