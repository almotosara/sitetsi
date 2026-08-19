import { createClient } from '@supabase/supabase-js'

export type SupabaseAdminConfigCode =
  | 'SUPABASE_URL_MISSING'
  | 'SUPABASE_ADMIN_KEY_MISSING'
  | 'SUPABASE_ADMIN_KEY_PUBLIC'

export class SupabaseAdminConfigError extends Error {
  constructor(public readonly code: SupabaseAdminConfigCode, message: string) {
    super(message)
    this.name = 'SupabaseAdminConfigError'
  }
}

function roleDaChaveLegada(chave: string): string | null {
  const partes = chave.split('.')
  if (partes.length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Supabase atual: sb_secret_*. Projetos antigos: JWT service_role.
  // Aceitamos os dois nomes para facilitar a migração sem expor a chave.
  const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new SupabaseAdminConfigError(
      'SUPABASE_URL_MISSING',
      'NEXT_PUBLIC_SUPABASE_URL não está configurada no servidor',
    )
  }

  if (!adminKey) {
    throw new SupabaseAdminConfigError(
      'SUPABASE_ADMIN_KEY_MISSING',
      'Configure SUPABASE_SECRET_KEY (recomendado) ou SUPABASE_SERVICE_ROLE_KEY no servidor',
    )
  }

  const roleLegada = roleDaChaveLegada(adminKey)
  if (adminKey.startsWith('sb_publishable_') || roleLegada === 'anon') {
    throw new SupabaseAdminConfigError(
      'SUPABASE_ADMIN_KEY_PUBLIC',
      'Foi usada uma chave pública do Supabase; a sincronização exige a chave Secret ou service_role',
    )
  }

  return createClient(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
