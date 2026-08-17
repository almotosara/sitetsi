import { createHash, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'

export const TV_COOKIE = 'am_tv_access'

export function tokenValido(recebido: string | null | undefined, esperado: string | undefined): boolean {
  if (!recebido || !esperado || esperado.length < 16) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function assinaturaTv(token: string): string {
  return createHash('sha256').update(`alagoas-motos-tv:${token}`).digest('hex')
}

export async function podeVerTv(): Promise<boolean> {
  const sessao = await getSession()
  if (sessao) return true

  const token = process.env.TV_ACCESS_TOKEN
  if (!token) return false
  const cookieStore = await cookies()
  return tokenValido(cookieStore.get(TV_COOKIE)?.value, assinaturaTv(token))
}
