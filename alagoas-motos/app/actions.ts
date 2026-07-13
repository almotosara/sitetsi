'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Lead, TsiRow, ClienteFiel, ReenvioRow } from '@/lib/types'

// ID fixo do usuário (single-user)
const USER_ID = '00000000-0000-0000-0000-000000000001'

// ─── LEADS ────────────────────────────────────────────────────────────────────

export async function getLeads() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data as Lead[]
}

export async function createLead(
  lead: Omit<Lead, 'id' | 'user_id' | 'criado_em' | 'atualizado_em'>
) {
  const supabase = await createClient()
  const { error } = await supabase.from('leads').insert({ ...lead, user_id: USER_ID })
  if (error) throw error
  revalidatePath('/')
}

export async function bulkCreateLeads(
  leads: Omit<Lead, 'id' | 'user_id' | 'criado_em' | 'atualizado_em'>[]
) {
  const supabase = await createClient()
  if (leads.length === 0) return []
  const { data, error } = await supabase
    .from('leads')
    .insert(leads.map((l) => ({ ...l, user_id: USER_ID })))
    .select()
  if (error) throw error
  revalidatePath('/')
  return data as Lead[]
}

export async function updateLead(
  id: string,
  lead: Partial<Omit<Lead, 'id' | 'user_id' | 'criado_em' | 'atualizado_em'>>
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update(lead)
    .eq('id', id)
  if (error) throw error
  revalidatePath('/')
}

export async function deleteLead(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)
  if (error) throw error
  revalidatePath('/')
}

// ─── TSI ──────────────────────────────────────────────────────────────────────

export async function getTsiData() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tsi_data')
    .select('*')
    .order('importado_em', { ascending: false })
  if (error) throw error
  return data as TsiRow[]
}

export async function replaceTsiData(rows: Omit<TsiRow, 'id' | 'user_id' | 'importado_em'>[]) {
  const supabase = await createClient()
  // Delete old data for this user
  await supabase.from('tsi_data').delete().eq('user_id', USER_ID)
  if (rows.length === 0) { revalidatePath('/'); return }
  const { error } = await supabase
    .from('tsi_data')
    .insert(rows.map((r) => ({ ...r, user_id: USER_ID })))
  if (error) throw error
  revalidatePath('/')
}

// ─── CLIENTES FIÉIS ───────────────────────────────────────────────────────────

export async function getClientesFieis() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes_fieis')
    .select('*')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data as ClienteFiel[]
}

export async function createClienteFiel(nome: string, whatsapp: string | null) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('clientes_fieis')
    .insert({ nome, whatsapp, user_id: USER_ID })
  if (error) throw error
  revalidatePath('/')
}

export async function updateClienteFiel(id: string, nome: string, whatsapp: string | null) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('clientes_fieis')
    .update({ nome, whatsapp })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/')
}

export async function deleteClienteFiel(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('clientes_fieis')
    .delete()
    .eq('id', id)
  if (error) throw error
  revalidatePath('/')
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

export async function getSettings() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', USER_ID)
    .maybeSingle()
  return data ?? { goal: 150, tsi_updated_at: null, display_name: null, avatar_url: null }
}

export async function upsertSettings(goal: number, tsi_updated_at?: string | null) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: USER_ID, goal, tsi_updated_at: tsi_updated_at ?? null })
  if (error) throw error
  revalidatePath('/')
}

// ─── PERFIL (nome de exibição + foto) ─────────────────────────────────────────

export async function updateProfile(display_name: string | null, avatar_url: string | null) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: USER_ID, display_name, avatar_url })
  if (error) throw error
  revalidatePath('/')
}
// ─── REENVIO DE PESQUISAS ─────────────────────────────────────────────────────

function rowFromDb(r: any): ReenvioRow {
  return {
    id: r.id,
    os: r.os || '',
    cliente: r.cliente,
    email: r.email,
    celular: r.celular,
    veiculo: r.veiculo,
    dataEnvioEmail: r.data_envio_email,
    dataEnvioSms: r.data_envio_sms,
    dataReenvio: r.data_reenvio,
    loja: r.loja,
    isFiel: r.is_fiel,
    contatado: r.contatado,
    contatado_em: r.contatado_em,
    contatado_canal: r.contatado_canal,
    importado_em: r.importado_em,
  }
}

export async function getReenvioData(): Promise<ReenvioRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reenvio_data')
    .select('*')
    .eq('user_id', USER_ID)
    .order('importado_em', { ascending: false })
  if (error) throw error
  return (data || []).map(rowFromDb)
}

export async function replaceReenvioData(rows: Omit<ReenvioRow, 'id' | 'user_id' | 'importado_em' | 'contatado' | 'contatado_em' | 'contatado_canal'>[]) {
  const supabase = await createClient()
  await supabase.from('reenvio_data').delete().eq('user_id', USER_ID)
  if (rows.length === 0) { revalidatePath('/'); return [] }
  const { data, error } = await supabase
    .from('reenvio_data')
    .insert(rows.map((r) => ({
      user_id: USER_ID,
      os: r.os,
      cliente: r.cliente,
      email: r.email,
      celular: r.celular,
      veiculo: r.veiculo,
      data_envio_email: r.dataEnvioEmail,
      data_envio_sms: r.dataEnvioSms,
      data_reenvio: r.dataReenvio,
      loja: r.loja,
      is_fiel: r.isFiel,
    })))
    .select('*')
  if (error) throw error
  revalidatePath('/')
  return (data || []).map(rowFromDb)
}

export async function markReenvioContatado(id: string, canal: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('reenvio_data')
    .update({ contatado: true, contatado_em: new Date().toISOString(), contatado_canal: canal })
    .eq('id', id)
    .eq('user_id', USER_ID)
  if (error) throw error
  revalidatePath('/')
}

export async function deleteReenvioRow(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('reenvio_data').delete().eq('id', id).eq('user_id', USER_ID)
  if (error) throw error
  revalidatePath('/')
}

// ─── HISTÓRICO MENSAL TSI (para o gráfico de evolução, meses sem pesquisas importadas) ───

export async function getTsiHistoricoMensal(): Promise<{ mes: string; label: string; avg_t2b: number }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tsi_historico_mensal')
    .select('mes, label, avg_t2b')
    .eq('user_id', USER_ID)
    .order('mes', { ascending: true })
  if (error) throw error
  return data || []
}

export async function upsertTsiHistoricoMensal(rows: { mes: string; label: string; avg_t2b: number }[]) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tsi_historico_mensal')
    .upsert(rows.map((r) => ({ ...r, user_id: USER_ID })), { onConflict: 'user_id,mes' })
  if (error) throw error
  revalidatePath('/')
}
