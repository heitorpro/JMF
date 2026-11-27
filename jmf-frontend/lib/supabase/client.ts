'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseEnv } from './env'

let browserClient: SupabaseClient | null = null

/** Cliente Supabase do navegador (sessão guardada em cookies, compartilhada com o servidor). */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, key } = supabaseEnv()
    browserClient = createBrowserClient(url, key)
  }
  return browserClient
}
