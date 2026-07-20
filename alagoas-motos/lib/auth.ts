import { cookies } from 'next/headers'

export type Role = 'consultor' | 'oficina'

interface Account {
  email: string
  password: string
  name: string
  role: Role
  userId: string
}

// Contas fixas do sistema
const ACCOUNTS: Account[] = [
  {
    email: 'consultor@alagoasmotos.com',
    password: 'Consul@01',
    name: 'Consultor',
    role: 'consultor',
    userId: '00000000-0000-0000-0000-000000000001',
  },
  {
    email: 'oficina@alagoasmotos.com',
    password: 'Oficina@01',
    name: 'Oficina',
    role: 'oficina',
    userId: '00000000-0000-0000-0000-000000000002',
  },
]

const SESSION_COOKIE = 'am_session'
const SESSION_SECRET = 'alagoas-motos-secret-2024'

// Gera token simples de sessão
function hashToken(email: string): string {
  const data = `${email}:${SESSION_SECRET}`
  return Buffer.from(data).toString('base64url')
}

function findAccount(email: string): Account | undefined {
  return ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase())
}

export function validateCredentials(email: string, password: string): boolean {
  const acc = findAccount(email)
  return !!acc && acc.password === password
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

  const acc = ACCOUNTS.find((a) => hashToken(a.email) === token)
  if (!acc) return null

  return {
    email: acc.email,
    name: acc.name,
    id: acc.userId,
    role: acc.role,
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
