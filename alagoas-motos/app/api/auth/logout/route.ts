import { NextResponse } from 'next/server'
import { auditAuthEvent, clientIp, deleteSessionCookie, getSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getSession()
  await auditAuthEvent('logout', session?.email ?? null, clientIp(request), {
    role: session?.role ?? null,
  })

  const response = NextResponse.json({ success: true })
  response.headers.set('Cache-Control', 'no-store')
  const cookie = deleteSessionCookie()
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  })
  return response
}
