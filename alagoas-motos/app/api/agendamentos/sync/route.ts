import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tokenValido } from '@/lib/tv-auth'
import type { AgendamentoImportado } from '@/lib/agendamentos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/

function texto(valor: unknown, limite: number): string {
  return String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, limite)
}

function normalizar(raw: unknown): AgendamentoImportado | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const data = texto(item.data_agendamento, 10)
  const hora = texto(item.hora_agendamento, 8)
  const empresa = texto(item.empresa, 30)
  const numero = texto(item.numero_agendamento, 40)
  const pessoa = texto(item.pessoa, 180)
  if (!DATA_RE.test(data) || !HORA_RE.test(hora) || !empresa || !numero || !pessoa) return null

  return {
    empresa,
    numero_agendamento: numero,
    data_agendamento: data,
    hora_agendamento: hora.length === 5 ? `${hora}:00` : hora,
    situacao: texto(item.situacao, 80) || 'Agendado',
    tipo_os: texto(item.tipo_os, 120) || null,
    placa: texto(item.placa, 20).toUpperCase() || null,
    modelo: texto(item.modelo, 140) || null,
    pessoa,
    telefone: texto(item.telefone, 40) || null,
    celular: texto(item.celular, 40) || null,
    consultor: texto(item.consultor, 160) || null,
  }
}

export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!tokenValido(bearer, process.env.AGENDAMENTOS_SYNC_TOKEN)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const recebidos = Array.isArray(body?.agendamentos) ? body.agendamentos.slice(0, 500) : []
    const agendamentos = recebidos.map(normalizar).filter(Boolean) as AgendamentoImportado[]

    if (!agendamentos.length) {
      return NextResponse.json({ error: 'Nenhum agendamento válido recebido' }, { status: 400 })
    }

    const agora = new Date().toISOString()
    const supabase = createAdminClient()

    // Quando toda a paginação está visível, registros que sumiram do DMS são
    // desativados antes do upsert. Assim cancelamentos/remoções não ficam na TV.
    if (body?.completo === true) {
      const escopos = new Set(agendamentos.map((a) => `${a.empresa}\u0000${a.data_agendamento}`))
      for (const escopo of escopos) {
        const [empresa, data] = escopo.split('\u0000')
        const { error } = await supabase
          .from('agendamentos_dms')
          .update({ ativo: false, sincronizado_em: agora })
          .eq('empresa', empresa)
          .eq('data_agendamento', data)
        if (error) throw error
      }
    }

    const capturado = new Date(body?.capturado_em)
    const capturadoEm = Number.isNaN(capturado.getTime()) ? agora : capturado.toISOString()
    const linhas = agendamentos.map((a) => ({
      ...a,
      origem: texto(body?.origem, 40) || 'microwork-dom',
      ativo: true,
      capturado_em: capturadoEm,
      sincronizado_em: agora,
    }))

    const { error } = await supabase
      .from('agendamentos_dms')
      .upsert(linhas, { onConflict: 'empresa,numero_agendamento' })
    if (error) throw error

    return NextResponse.json({ ok: true, sincronizados: linhas.length, completo: body?.completo === true })
  } catch (erro) {
    console.error('[agendamentos/sync]', erro)
    return NextResponse.json({ error: 'Falha ao sincronizar agendamentos' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://microworkcloud.com.br',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    },
  })
}
