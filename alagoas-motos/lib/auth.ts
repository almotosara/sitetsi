import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { compare } from 'bcryptjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export type Role = 'consultor' | 'oficina' | 'admin'
export type AuthAuditEvent = 'login_success' | 'login_failed' | 'logout'

interface AppUserRow {
  id: string
  email: string
  password_hash: string
  name: string
  role: Role
  session_version: number
  created_at: string
  last_login_at: string | null
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  sessionVersion: number
}

interface SignedSessionPayload {
  email: string
  role: Role
  sessionVersion: number
  expiresAt: number
}

const SESSION_COOKIE = 'am_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const VALID_ROLES = new Set<Role>(['consultor', 'oficina', 'admin'])

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET precisa ter pelo menos 32 caracteres e existir apenas no servidor')
  }
  return secret
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function toAuthUser(row: AppUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    sessionVersion: row.session_version,
  }
}

function signPayload(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload, 'utf8').digest()
}

function encodePayload(payload: SignedSessionPayload) {
  return `${payload.email}:${payload.role}:${payload.sessionVersion}:${payload.expiresAt}`
}

function parsePayload(value: string): SignedSessionPayload | null {
  const [email, roleValue, sessionVersionValue, expiresAtValue, ...extra] = value.split(':')
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

  return { email: normalizeEmail(email), role, sessionVersion, expiresAt }
}

/** Validação Node usada pelas páginas e rotas de API. O middleware possui a
 * versão Web Crypto equivalente para permanecer compatível com Edge Runtime. */
export function verifySessionToken(token: string): SignedSessionPayload | null {
  if (!token || token.length > 2048) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  try {
    const payloadText = Buffer.from(parts[0], 'base64url').toString('utf8')
    const receivedSignature = Buffer.from(parts[1], 'base64url')
    const expectedSignature = signPayload(payloadText)
    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) return null
    return parsePayload(payloadText)
  } catch {
    return null
  }
}

export async function validateCredentials(email: string, password: string): Promise<AuthUser | null> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !password || normalizedEmail.length > 254 || password.length > 256) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('app_users')
    .select('id, email, password_hash, name, role, session_version, created_at, last_login_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as AppUserRow
  const passwordMatches = await compare(password, row.password_hash)
  if (!passwordMatches) return null

  const lastLoginAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('app_users')
    .update({ last_login_at: lastLoginAt })
    .eq('id', row.id)
  if (updateError) {
    console.warn(JSON.stringify({ event: 'auth_last_login_update_failed', email: normalizedEmail, timestamp: lastLoginAt }))
  }

  return toAuthUser({ ...row, last_login_at: lastLoginAt })
}

export function createSession(user: AuthUser) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000
  const payload = encodePayload({
    email: normalizeEmail(user.email),
    role: user.role,
    sessionVersion: user.sessionVersion,
    expiresAt,
  })
  const token = `${Buffer.from(payload, 'utf8').toString('base64url')}.${signPayload(payload).toString('base64url')}`

  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  let payload: SignedSessionPayload | null = null
  try {
    payload = verifySessionToken(token)
  } catch (error) {
    console.error(JSON.stringify({ event: 'auth_session_config_error', message: error instanceof Error ? error.message : 'unknown', timestamp: new Date().toISOString() }))
    return null
  }
  if (!payload) return null

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('app_users')
      .select('id, email, password_hash, name, role, session_version, created_at, last_login_at')
      .eq('email', payload.email)
      .maybeSingle()

    if (error || !data) return null
    const row = data as AppUserRow
    if (row.role !== payload.role || row.session_version !== payload.sessionVersion) return null
    return toAuthUser(row)
  } catch (error) {
    console.error(JSON.stringify({ event: 'auth_session_lookup_failed', email: payload.email, message: error instanceof Error ? error.message : 'unknown', timestamp: new Date().toISOString() }))
    return null
  }
}

export async function auditAuthEvent(
  event: AuthAuditEvent,
  email: string | null,
  ipAddress: string,
  metadata: Record<string, unknown> = {},
) {
  const timestamp = new Date().toISOString()
  const entry = { event, email: email ? normalizeEmail(email) : null, ip: ipAddress, timestamp, ...metadata }
  console.log(JSON.stringify(entry))

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('auth_audit_log').insert({
      event,
      email: entry.email,
      ip_address: ipAddress,
      metadata,
      created_at: timestamp,
    })
    if (error) throw error
  } catch (error) {
    // O log estruturado acima continua disponível mesmo antes da migração SQL.
    console.warn(JSON.stringify({ event: 'auth_audit_persist_failed', sourceEvent: event, timestamp, message: error instanceof Error ? error.message : 'unknown' }))
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-real-ip') || 'unknown'
}

export function deleteSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}
