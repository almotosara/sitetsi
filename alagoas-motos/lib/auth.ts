import { cookies } from 'next/headers'

// Credenciais fixas do sistema
const VALID_EMAIL = 'consultor@alagoasmotos.com'
const VALID_PASSWORD = 'Consul@01'
const SESSION_COOKIE = 'am_session'
const SESSION_SECRET = 'alagoas-motos-secret-2024'

// Gera token simples de sessão
function hashToken(email: string): string {
  const data = `${email}:${SESSION_SECRET}`
  // Hash simples base64 (suficiente para app single-user)
  return Buffer.from(data).toString('base64url')
}

export function validateCredentials(email: string, password: string): boolean {
  return email === VALID_EMAIL && password === VALID_PASSWORD
}

export function createSession(email: string) {
  const token = hashToken(email)
  return {
    name: 'am_session',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const expected = hashToken(VALID_EMAIL)
  if (token !== expected) return null
  return {
    email: VALID_EMAIL,
    name: 'Consultor',
    id: '00000000-0000-0000-0000-000000000001',
  }
}

export function deleteSessionCookie() {
  return {
    name: 'am_session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}