import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELECT_FIELDS = 'id, modelos, tmo_hora_valor, revisao_geral_valor, ordem'
const EDITABLE_FIELDS = new Set(['tmo_hora_valor', 'revisao_geral_valor'])

async function requireAdmin() {
  const session = await getSession()
  return session?.role === 'admin' ? session : null
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    const requestHost = (request.headers.get('x-forwarded-host') || request.headers.get('host'))
      ?.split(',')[0]
      ?.trim()
    return Boolean(requestHost) && new URL(origin).host === requestHost
  } catch {
    return false
  }
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('rev_mao_de_obra')
      .select(SELECT_FIELDS)
      .order('ordem')

    if (error) throw error
    return NextResponse.json({ rows: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao carregar valores' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Origem não permitida' }, { status: 403 })
  }

  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json() as { id?: unknown; field?: unknown; value?: unknown }
    const id = Number(body.id)
    const field = typeof body.field === 'string' ? body.field : ''
    const value = Number(body.value)

    if (!Number.isSafeInteger(id) || id <= 0 || !EDITABLE_FIELDS.has(field)) {
      return NextResponse.json({ error: 'Campo ou grupo inválido' }, { status: 400 })
    }
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'O valor deve ser um número maior ou igual a zero' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('rev_mao_de_obra')
      .update({ [field]: value })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single()

    if (error) throw error

    // /api/revisoes já usa no-store; a revalidação também cobre uma eventual
    // mudança futura para cache e as páginas que consomem esses dados.
    revalidatePath('/api/revisoes')
    revalidatePath('/')

    return NextResponse.json({ row: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao salvar valor' },
      { status: 500 },
    )
  }
}
