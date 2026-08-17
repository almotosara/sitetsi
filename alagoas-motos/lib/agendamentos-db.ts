import { createAdminClient } from '@/lib/supabase/admin'
import { mascararNome, mascararPlaca, type AgendamentoTv } from '@/lib/agendamentos'

const TIME_ZONE = 'America/Maceio'

export function dataLocalHoje(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export async function carregarAgendamentosTv(data = dataLocalHoje()) {
  const supabase = createAdminClient()
  const { data: linhas, error } = await supabase
    .from('agendamentos_dms')
    .select('id,empresa,numero_agendamento,data_agendamento,hora_agendamento,situacao,tipo_os,placa,modelo,pessoa,consultor,sincronizado_em')
    .eq('data_agendamento', data)
    .eq('ativo', true)
    .order('hora_agendamento', { ascending: true })

  if (error) throw error

  const agendamentos: AgendamentoTv[] = (linhas ?? []).map((linha) => ({
    id: linha.id,
    empresa: linha.empresa,
    numero_agendamento: linha.numero_agendamento,
    data_agendamento: linha.data_agendamento,
    hora_agendamento: linha.hora_agendamento,
    situacao: linha.situacao || 'Agendado',
    tipo_os: linha.tipo_os,
    placa_exibicao: mascararPlaca(linha.placa),
    modelo: linha.modelo,
    nome_exibicao: mascararNome(linha.pessoa || ''),
    consultor: linha.consultor,
    sincronizado_em: linha.sincronizado_em,
  }))

  const sincronizadoEm = agendamentos.reduce<string | null>((maisRecente, item) => {
    if (!maisRecente || item.sincronizado_em > maisRecente) return item.sincronizado_em
    return maisRecente
  }, null)

  return { data, agendamentos, sincronizado_em: sincronizadoEm }
}
