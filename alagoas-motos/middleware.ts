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

type Role = 'consultor' | 'oficina' | 'admin'

interface EdgeSession {
  email: string
  role: Role
  sessionVersion: number
  expiresAt: number
}

const VALID_ROLES = new Set<Role>(['consultor', 'oficina', 'admin'])

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const decoded = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0))
}

function decodeUtf8Base64Url(value: string) {
  return new TextDecoder().decode(decodeBase64Url(value))
}

async function verifySessionToken(token: string): Promise<EdgeSession | null> {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32 || !token || token.length > 2048) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  try {
    const payloadText = decodeUtf8Base64Url(parts[0])
    const signature = decodeBase64Url(parts[1])
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const signatureValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(payloadText),
    )
    if (!signatureValid) return null

    const [email, roleValue, sessionVersionValue, expiresAtValue, ...extra] = payloadText.split(':')
    const role = roleValue as Role
    const sessionVersion = Number(sessionVersionValue)
    const expiresAt = Number(expiresAtValue)
    if (
      extra.length > 0 ||
      !email ||
      !VALID_ROLES.has(role) ||
      !Number.isInteger(sessionVersion) || sessionVersion < 0 ||
      !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()
    ) return null

    return { email: email.toLowerCase(), role, sessionVersion, expiresAt }
  } catch {
    return null
  }
}

function unauthenticatedRoot(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/auth/login'
  const response = NextResponse.rewrite(url)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function redirectToLogin(request: NextRequest, clearInvalidCookie = false) {
  const url = request.nextUrl.clone()
  url.pathname = '/auth/login'
  const response = NextResponse.redirect(url)
  if (clearInvalidCookie) response.cookies.delete('am_session')
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const rawSession = request.cookies.get('am_session')?.value
  const session = rawSession ? await verifySessionToken(rawSession) : null
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  // A raiz continua exibindo o login por rewrite, sem salto visual adicional.
  if (!session && pathname === '/') return unauthenticatedRoot(request)

  if (!session && !isPublic) return redirectToLogin(request, Boolean(rawSession))

  // O role vem do payload assinado; não há chamada ao Supabase no Edge.
  if (pathname.startsWith('/admin') && session?.role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = session ? '/' : '/auth/login'
    return NextResponse.redirect(url)
  }

  if (session && pathname === '/auth/login') {
    const url = request.nextUrl.clone()
    url.pathname = session.role === 'admin' ? '/admin' : '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)',
  ],
}
