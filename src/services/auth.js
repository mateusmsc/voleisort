import { supabase } from './supabase'

/**
 * Garante que existe uma sessão autenticada (anônima).
 * Chamado uma única vez no boot do app, antes de qualquer query.
 * Se já existe sessão salva no localStorage, o SDK a restaura sem criar novo usuário.
 */
export async function ensureAuth() {
  const { data: { session } } = await supabase.auth.getSession()

  if (session) return session  // já autenticado

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw new Error(`Auth falhou: ${error.message}`)

  return data.session
}
