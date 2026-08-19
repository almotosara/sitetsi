import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/auth/login',
  '/api/auth/login',
  '/api/revisoes',
  '/api/agendamentos/sync',
  '/api/agendamentos/tv',
  '/tv/agendamentos',
]
const ADMIN_EMAIL = 'administrativo@alagoasmotos.com'

// O token de sessão é base64url de "email:segredo" — aqui só precisamos do e-mail.
function emailFromToken(token: string): string | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    return decoded.split(':')[0] || null
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get('am_session')

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // Não autenticado tentando acessar rota protegida → redireciona para login
  if (!session && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  const email = session ? emailFromToken(session.value) : null

  // Área administrativa: só o usuário admin entra (nem digitando a URL direto)
  if (pathname.startsWith('/admin') && email !== ADMIN_EMAIL) {
    const url = request.nextUrl.clone()
    url.pathname = session ? '/' : '/auth/login'
    return NextResponse.redirect(url)
  }

  // Autenticado na página de login → redireciona para a home certa
  if (session && pathname === '/auth/login') {
    const url = request.nextUrl.clone()
    url.pathname = email === ADMIN_EMAIL ? '/admin' : '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)',
  ],
}
