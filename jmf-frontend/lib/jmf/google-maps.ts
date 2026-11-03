'use client'

/**
 * Carregamento da Google Maps JavaScript API (mapa, Places e Geocoding).
 *
 * Configure no .env.local (e na Vercel):
 *   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...   chave restrita por site (HTTP referrer)
 *   NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=...    opcional; sem ele usa o "DEMO_MAP_ID" (só para testes)
 *
 * APIs que precisam estar ativadas no Google Cloud: Maps JavaScript API, Places API (New) e Geocoding API.
 * Sem chave (ou se a chave for recusada), o sistema volta a usar o OpenStreetMap automaticamente.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

let loading: Promise<any> | null = null
let authFailed = false
const failureListeners = new Set<() => void>()

/** Avisa quando o Google recusa a chave (os mapas trocam para o OpenStreetMap). */
export function onGoogleMapsFailure(listener: () => void) {
  failureListeners.add(listener)
  return () => { failureListeners.delete(listener) }
}

/** true quando há chave configurada e o Google não a recusou. */
export function googleMapsEnabled() {
  return Boolean(GOOGLE_MAPS_API_KEY) && !authFailed
}

function googleGlobal(): any {
  return (window as any).google
}

/** Carrega o script uma única vez e devolve o namespace google.maps. */
export function loadGoogleMaps(): Promise<any> {
  if (!googleMapsEnabled()) return Promise.reject(new Error('Google Maps não configurado'))
  const existing = googleGlobal()?.maps
  if (existing?.importLibrary) return Promise.resolve(existing)
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const callback = '__jmfGoogleMapsReady'
      ;(window as any)[callback] = () => resolve(googleGlobal().maps)
      // Chamado pelo Google quando a chave é inválida ou não autorizada para este site.
      ;(window as any).gm_authFailure = () => {
        authFailed = true
        failureListeners.forEach((listener) => listener())
        console.error('Google Maps recusou a chave. Confira NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, as APIs ativadas e as restrições de site.')
      }
      const params = new URLSearchParams({
        key: GOOGLE_MAPS_API_KEY,
        v: 'weekly',
        loading: 'async',
        language: 'pt-BR',
        region: 'BR',
        libraries: 'places,geocoding,marker',
        callback,
      })
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
      script.async = true
      script.onerror = () => {
        loading = null
        reject(new Error('Não foi possível carregar o Google Maps'))
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

export async function importGoogleLibrary(name: 'maps' | 'marker' | 'places' | 'geocoding'): Promise<any> {
  const maps = await loadGoogleMaps()
  return maps.importLibrary(name)
}
