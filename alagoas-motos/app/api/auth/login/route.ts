import { NextResponse } from 'next/server'
import { auditAuthEvent, clientIp, createSession, validateCredentials } from '@/lib/auth'

export const runtime = 'nodejs'

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const RATE_LIMIT_MAX_ATTEMPTS = 5

interface AttemptBucket {
  timestamps: number[]
}

const rateLimitGlobal = globalThis as typeof globalThis & {
  __alagoasLoginAttempts?: Map<string, AttemptBucket>
}
const loginAttempts = rateLimitGlobal.__alagoasLoginAttempts ?? new Map<string, AttemptBucket>()
rateLimitGlobal.__alagoasLoginAttempts = loginAttempts

function consumeAttempt(ip: string) {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const previous = loginAttempts.get(ip)?.timestamps.filter((timestamp) => timestamp > cutoff) ?? []

  if (previous.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((previous[0] + RATE_LIMIT_WINDOW_MS - now) / 1000))
    loginAttempts.set(ip, { timestamps: previous })
    return { allowed: false as const, retryAfterSeconds }
  }

  previous.push(now)
  loginAttempts.set(ip, { timestamps: previous })

  // Em produção com múltiplas instâncias, substitua este Map por Upstash Redis
  // (ou equivalente) para compartilhar a janela entre todas as funções.
  if (loginAttempts.size > 1_000) {
    for (const [key, bucket] of loginAttempts) {
      if (bucket.timestamps.every((timestamp) => timestamp <= cutoff)) loginAttempts.delete(key)
    }
  }
  return { allowed: true as const, retryAfterSeconds: 0 }
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  let email = ''

  try {
    const body = await request.json() as { email?: unknown; password?: unknown }
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const rateLimit = consumeAttempt(ip)

    if (!rateLimit.allowed) {
      await auditAuthEvent('login_failed', email || null, ip, { reason: 'rate_limited' })
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds), 'Cache-Control': 'no-store' } },
      )
    }

    if (!email || !password) {
      await auditAuthEvent('login_failed', email || null, ip, { reason: 'missing_credentials' })
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const user = await validateCredentials(email, password)
    if (!user) {
      await auditAuthEvent('login_failed', email, ip, { reason: 'invalid_credentials' })
      return NextResponse.json(
        { error: 'Email ou senha incorretos' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    loginAttempts.delete(ip)
    await auditAuthEvent('login_success', user.email, ip, { role: user.role })
    const response = NextResponse.json({ success: true, role: user.role })
    response.headers.set('Cache-Control', 'no-store')
    const cookie = createSession(user)
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    })
    return response
  } catch (error) {
    await auditAuthEvent('login_failed', email || null, ip, {
      reason: 'internal_error',
      errorType: error instanceof Error ? error.name : 'unknown',
    })
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
