import { NextResponse } from 'next/server'
import { assinaturaTv, tokenValido, TV_COOKIE } from '@/lib/tv-auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const chave = url.searchParams.get('chave')
  const destino = new URL('/tv/agendamentos', url.origin)

  if (!tokenValido(chave, process.env.TV_ACCESS_TOKEN)) {
    destino.searchParams.set('erro', 'acesso')
    return NextResponse.redirect(destino)
  }

  const response = NextResponse.redirect(destino)
  response.cookies.set(TV_COOKIE, assinaturaTv(chave!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // A API de atualização da TV fica em /api/agendamentos/tv, portanto o
    // cookie precisa valer para todo o mesmo domínio.
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  })
  return response
}
