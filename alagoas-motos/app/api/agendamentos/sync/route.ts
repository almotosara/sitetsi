import { NextResponse } from 'next/server'
import { createAdminClient, SupabaseAdminConfigError } from '@/lib/supabase/admin'
import { tokenValido } from '@/lib/tv-auth'
import type { AgendamentoImportado } from '@/lib/agendamentos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://microworkcloud.com.br',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
}

type FalhaSupabase = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: CORS_HEADERS })
}

function respostaFalha(erro: unknown) {
  if (erro instanceof SupabaseAdminConfigError) {
    return json({ error: erro.message, code: erro.code }, 503)
  }

  const falha = (erro && typeof erro === 'object' ? erro : {}) as FalhaSupabase
  const codigo = String(falha.code || '')
  const mensagem = String(falha.message || (erro instanceof Error ? erro.message : ''))
  const textoErro = `${codigo} ${mensagem} ${falha.details || ''} ${falha.hint || ''}`.toLowerCase()

  if (codigo === '42P01' || codigo === 'PGRST205' || /agendamentos_dms.*(does not exist|schema cache)/i.test(textoErro)) {
    return json({
      error: 'A tabela agendamentos_dms ainda não existe no Supabase. Execute o arquivo supabase-agendamentos.sql no SQL Editor.',
      code: 'AGENDAMENTOS_TABLE_MISSING',
    }, 503)
  }

  if (codigo === '42P10' || /no unique or exclusion constraint/i.test(textoErro)) {
    return json({
      error: 'A tabela de agendamentos está com o esquema antigo. Execute novamente supabase-agendamentos.sql no SQL Editor.',
      code: 'AGENDAMENTOS_SCHEMA_OUTDATED',
    }, 503)
  }

  if (codigo === '42501' || /permission denied|row-level security|invalid api key|jwt/i.test(textoErro)) {
    return json({
      error: 'O Supabase recusou a gravação. Use a chave Secret (sb_secret_...) ou a service_role na variável SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.',
      code: 'SUPABASE_ADMIN_PERMISSION_DENIED',
    }, 503)
  }

  return json({
    error: `Falha no Supabase${codigo ? ` (${codigo})` : ''}. Consulte o log da função no Netlify.`,
    code: codigo || 'AGENDAMENTOS_SYNC_FAILED',
  }, 500)
}

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
  const tokenServidor = process.env.AGENDAMENTOS_SYNC_TOKEN?.trim()
  if (!tokenServidor || tokenServidor.length < 16) {
    return json({
      error: 'AGENDAMENTOS_SYNC_TOKEN não está configurado corretamente no Netlify. Salve a variável e publique um novo deploy.',
      code: 'SYNC_TOKEN_NOT_CONFIGURED',
    }, 503)
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!tokenValido(bearer, tokenServidor)) {
    return json({ error: 'Token de sincronização não autorizado', code: 'SYNC_TOKEN_INVALID' }, 401)
  }

  try {
    const body = await request.json()
    const recebidos = Array.isArray(body?.agendamentos) ? body.agendamentos.slice(0, 500) : []
    const agendamentos = recebidos.map(normalizar).filter(Boolean) as AgendamentoImportado[]

    if (!agendamentos.length) {
      return json({ error: 'Nenhum agendamento válido recebido', code: 'NO_VALID_APPOINTMENTS' }, 400)
    }

    const agora = new Date().toISOString()
    const supabase = createAdminClient()

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

    // Só desativa registros antigos depois que o upsert terminou. Assim uma
    // falha de gravação nunca apaga a agenda que já estava disponível na TV.
    if (body?.completo === true) {
      const escopos = new Set(agendamentos.map((a) => `${a.empresa}\u0000${a.data_agendamento}`))
      for (const escopo of escopos) {
        const [empresa, data] = escopo.split('\u0000')
        const numerosAtuais = new Set(
          agendamentos
            .filter((a) => a.empresa === empresa && a.data_agendamento === data)
            .map((a) => a.numero_agendamento),
        )
        const { data: existentes, error: erroConsulta } = await supabase
          .from('agendamentos_dms')
          .select('id,numero_agendamento')
          .eq('empresa', empresa)
          .eq('data_agendamento', data)
          .eq('ativo', true)
        if (erroConsulta) throw erroConsulta

        const idsInativos = (existentes ?? [])
          .filter((item) => !numerosAtuais.has(item.numero_agendamento))
          .map((item) => item.id)
        if (idsInativos.length) {
          const { error: erroInativacao } = await supabase
            .from('agendamentos_dms')
            .update({ ativo: false, sincronizado_em: agora })
            .in('id', idsInativos)
          if (erroInativacao) throw erroInativacao
        }
      }
    }

    return json({ ok: true, sincronizados: linhas.length, completo: body?.completo === true })
  } catch (erro) {
    console.error('[agendamentos/sync]', erro)
    return respostaFalha(erro)
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}
