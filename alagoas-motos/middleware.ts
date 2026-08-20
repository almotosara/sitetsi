import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/error',
  '/api/auth/login',
  '/api/revisoes',
  '/api/agendamentos/sync',
  '/api/agendamentos/tv',
  '/tv/agendamentos',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/sw.js',
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

  // A raiz mostra o login sem uma viagem extra de redirecionamento. Com uma
  // sessão válida, a requisição segue normalmente para o painel correto.
  if (!session && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    const response = NextResponse.rewrite(url)
    response.headers.set('Cache-Control', 'private, no-store, max-age=0')
    response.headers.set('Vary', 'Cookie')
    return response
  }

  // Não autenticado tentando acessar outra rota protegida → login.
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
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)',
  ],
}
