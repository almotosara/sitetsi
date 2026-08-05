// Leitura/montagem dos dados de valores e mercadorias a partir do Supabase.
// O formato de saída é o mesmo do antigo public/data/revisoes.json,
// acrescido de "servicos_avulsos".

import { createClient } from '@/lib/supabase/server'

export interface DbMercadoria {
  id: number
  codigo: string
  descricao: string
  valor_unitario: number | null
}
export interface DbModelo {
  id: number
  nome: string
  periodo: string | null
  ordem: number
}
export interface DbRevisao {
  id: number
  modelo_id: number
  numero: number
  km: number | null
  meses: number | null
  tmo_horas: number | null
  mao_de_obra_gratis: boolean
  mao_de_obra_valor: number | null
  servicos: { servico: string; acao: string }[]
  servico_dms_codigo: string | null
}
export interface DbItem {
  id: number
  revisao_id: number
  mercadoria_id: number
  quantidade: number
  valor_unitario: number | null
  descricao: string | null
}
export interface DbServicoAvulso {
  id: number
  nome: string
  mao_de_obra_valor: number | null
  ordem: number
}
export interface DbServicoItem extends Omit<DbItem, 'revisao_id'> {
  servico_id: number
}

// O Supabase devolve no máximo 1000 linhas por request — busca paginada.
export async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  order = 'id'
): Promise<T[]> {
  const page = 1000
  let from = 0
  const rows: T[] = []
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(order, { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < page) break
    from += page
  }
  return rows
}

export async function buildRevisoesPayload() {
  const supabase = await createClient()

  const [mercadorias, modelos, revisoes, itens, avulsos, avulsosItens, maoDeObra] =
    await Promise.all([
      fetchAll<DbMercadoria>(supabase, 'rev_mercadorias'),
      fetchAll<DbModelo>(supabase, 'rev_modelos', 'ordem'),
      fetchAll<DbRevisao>(supabase, 'rev_revisoes'),
      fetchAll<DbItem>(supabase, 'rev_revisao_itens'),
      fetchAll<DbServicoAvulso>(supabase, 'rev_servicos_avulsos', 'ordem'),
      fetchAll<DbServicoItem>(supabase, 'rev_servico_itens'),
      fetchAll<{
        id: number
        modelos: string
        tmo_hora_valor: number | null
        revisao_geral_valor: number | null
      }>(supabase, 'rev_mao_de_obra', 'ordem'),
    ])

  const mercById = new Map(mercadorias.map((m) => [m.id, m]))

  function toPeca(it: { mercadoria_id: number; quantidade: number; valor_unitario: number | null; descricao: string | null }) {
    const m = mercById.get(it.mercadoria_id)
    const vu = it.valor_unitario ?? m?.valor_unitario ?? null
    const qtd = it.quantidade ?? 1
    return {
      descricao: it.descricao ?? m?.descricao ?? '',
      codigo: m?.codigo ?? null,
      valor_unitario: vu,
      quantidade: qtd,
      total: vu == null ? null : Number((vu * qtd).toFixed(2)),
    }
  }

  const itensPorRevisao = new Map<number, DbItem[]>()
  for (const it of itens) {
    const arr = itensPorRevisao.get(it.revisao_id) ?? []
    arr.push(it)
    itensPorRevisao.set(it.revisao_id, arr)
  }
  const revisoesPorModelo = new Map<number, DbRevisao[]>()
  for (const r of revisoes) {
    const arr = revisoesPorModelo.get(r.modelo_id) ?? []
    arr.push(r)
    revisoesPorModelo.set(r.modelo_id, arr)
  }

  const modelosOut = modelos.map((mod) => ({
    modelo: mod.nome,
    periodo: mod.periodo ?? '',
    revisoes: (revisoesPorModelo.get(mod.id) ?? [])
      .sort((a, b) => a.numero - b.numero)
      .map((r) => {
        const pecas = (itensPorRevisao.get(r.id) ?? []).map(toPeca)
        const pecasTotal = Number(
          pecas.reduce((s, p) => s + (p.total ?? 0), 0).toFixed(2)
        )
        const mo = r.mao_de_obra_gratis ? 0 : r.mao_de_obra_valor ?? 0
        return {
          numero: r.numero,
          km: r.km,
          meses: r.meses,
          tmo_horas: r.tmo_horas,
          pecas,
          servicos: r.servicos ?? [],
          pecas_total: pecasTotal,
          mao_de_obra_gratis: r.mao_de_obra_gratis,
          mao_de_obra_valor: r.mao_de_obra_valor,
          servico_dms_codigo: r.servico_dms_codigo ?? null,
          total: Number((pecasTotal + mo).toFixed(2)),
        }
      }),
  }))

  const itensPorServico = new Map<number, DbServicoItem[]>()
  for (const it of avulsosItens) {
    const arr = itensPorServico.get(it.servico_id) ?? []
    arr.push(it)
    itensPorServico.set(it.servico_id, arr)
  }

  const servicosAvulsos = avulsos.map((s) => {
    const pecas = (itensPorServico.get(s.id) ?? []).map(toPeca)
    const pecasTotal = Number(pecas.reduce((acc, p) => acc + (p.total ?? 0), 0).toFixed(2))
    return {
      nome: s.nome,
      mao_de_obra_valor: s.mao_de_obra_valor,
      mercadorias: pecas,
      pecas_total: pecasTotal,
      total: Number((pecasTotal + (s.mao_de_obra_valor ?? 0)).toFixed(2)),
    }
  })

  return {
    atualizado_em: new Date().toISOString(),
    modelos: modelosOut,
    servicos_avulsos: servicosAvulsos,
    mao_de_obra: maoDeObra.map((g) => ({
      modelos: g.modelos,
      tmo_hora_valor: g.tmo_hora_valor,
      revisao_geral_valor: g.revisao_geral_valor,
    })),
    valores_mercadoria: mercadorias.map((m) => ({
      codigo: m.codigo,
      descricao: m.descricao,
      valor: m.valor_unitario,
    })),
  }
}
