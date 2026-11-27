import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/** Usuário autenticado (validado no servidor do Supabase) ou null. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

/** Nome exibido: user_metadata.name, ou a parte do e-mail antes do @. */
export function displayName(user: User) {
  const name = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : ''
  return name || (user.email ? user.email.split('@')[0] : 'Usuário')
}

/**
 * Acesso à área do gestor: app_metadata.role = "admin" (definido só pelo servidor do Supabase).
 * O backend continua sendo quem decide as permissões de cada rota.
 */
export function hasJmfManagementAccess(user: Pick<User, 'app_metadata'>) {
  const role = user.app_metadata?.role ?? user.app_metadata?.roles
  const roles = Array.isArray(role) ? role : [role]
  return roles.includes('admin')
}
