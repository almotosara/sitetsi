// ============================================================================
// Server actions da dashboard de Ordens de Serviço (conta oficina)
// Isoladas em arquivo próprio para NÃO impactar as actions de TSI/leads.
// ============================================================================
'use server'

import { createClient } from '@/lib/supabase/server'
import type { OSLinha } from '@/lib/os-types'

const OFICINA_USER_ID = '00000000-0000-0000-0000-000000000002'

export async function getOsLinhas(): Promise<OSLinha[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('os_linhas')
    .select('*')
    .eq('user_id', OFICINA_USER_ID)
    .order('emissao', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    emissao: r.emissao ?? '',
    numero_os: r.numero_os,
    situacao: r.situacao ?? '',
    tipo_os: r.tipo_os ?? '',
    pessoa: r.pessoa ?? '',
    modelo: r.modelo ?? '',
    placa: r.placa ?? '',
    total_desconto: Number(r.total_desconto ?? 0),
    total_servico: Number(r.total_servico ?? 0),
    total_acrescimo: Number(r.total_acrescimo ?? 0),
    total_mercadoria: Number(r.total_mercadoria ?? 0),
    valor_total: Number(r.valor_total ?? 0),
    empresa: r.empresa ?? '',
    consultor: r.consultor ?? '',
  }))
}

export async function replaceOsLinhas(linhas: OSLinha[]) {
  const supabase = await createClient()
  const { error: delErr } = await supabase
    .from('os_linhas')
    .delete()
    .eq('user_id', OFICINA_USER_ID)
  if (delErr) throw delErr
  if (linhas.length === 0) return { count: 0 }
  const payload = linhas.map((l) => ({ ...l, user_id: OFICINA_USER_ID }))
  const chunk = 500
  for (let i = 0; i < payload.length; i += chunk) {
    const slice = payload.slice(i, i + chunk)
    const { error } = await supabase.from('os_linhas').insert(slice)
    if (error) throw error
  }
  return { count: linhas.length }
}
