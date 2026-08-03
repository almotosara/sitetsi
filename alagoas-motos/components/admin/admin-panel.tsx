'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const VERDE = '#0f7a5a'

interface Mercadoria { id: number; codigo: string; descricao: string; valor_unitario: number | null }
interface Modelo { id: number; nome: string; periodo: string | null; ordem: number }
interface Revisao {
  id: number; modelo_id: number; numero: number; km: number | null; meses: number | null
  tmo_horas: number | null; mao_de_obra_gratis: boolean; mao_de_obra_valor: number | null
}
interface Item {
  id: number; revisao_id?: number; servico_id?: number; mercadoria_id: number
  quantidade: number; valor_unitario: number | null; descricao: string | null
  mercadoria?: Mercadoria
}
interface ServicoAvulso { id: number; nome: string; mao_de_obra_valor: number | null; ordem: number }

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function num(v: string): number | null {
  const t = v.replace(',', '.').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const card: React.CSSProperties = {
  background: 'var(--bg-panel, #fff)',
  border: '1px solid rgba(127,127,127,.25)',
  borderRadius: 12,
}
const inputStyle: React.CSSProperties = {
  border: '1px solid rgba(127,127,127,.35)',
  borderRadius: 8,
  padding: '6px 8px',
  background: 'transparent',
  color: 'inherit',
  width: '100%',
  fontSize: 13,
}
const btn: React.CSSProperties = {
  background: VERDE, color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'inherit', border: '1px solid rgba(127,127,127,.35)',
  borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
}

type Aba = 'revisoes' | 'avulsos' | 'catalogo'

export function AdminPanel({ userEmail }: { userEmail: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [aba, setAba] = useState<Aba>('revisoes')
  const [msg, setMsg] = useState<string | null>(null)

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [busca, setBusca] = useState('')
  const [modeloSel, setModeloSel] = useState<Modelo | null>(null)
  const [revisoes, setRevisoes] = useState<Revisao[]>([])
  const [revSel, setRevSel] = useState<Revisao | null>(null)
  const [itens, setItens] = useState<Item[]>([])

  const [avulsos, setAvulsos] = useState<ServicoAvulso[]>([])
  const [avulsoSel, setAvulsoSel] = useState<ServicoAvulso | null>(null)
  const [itensAvulso, setItensAvulso] = useState<Item[]>([])

  const [catBusca, setCatBusca] = useState('')
  const [catResultados, setCatResultados] = useState<Mercadoria[]>([])

  const [addAberto, setAddAberto] = useState(false)

  const aviso = useCallback((t: string) => {
    setMsg(t)
    setTimeout(() => setMsg(null), 2500)
  }, [])

  // ─── carregamentos ─────────────────────────────────────────────
  useEffect(() => {
    supabase.from('rev_modelos').select('*').order('ordem').then(({ data }) => {
      setModelos((data ?? []) as Modelo[])
    })
    supabase.from('rev_servicos_avulsos').select('*').order('ordem').then(({ data }) => {
      setAvulsos((data ?? []) as ServicoAvulso[])
    })
  }, [supabase])

  const carregarRevisoes = useCallback(async (m: Modelo) => {
    const { data } = await supabase.from('rev_revisoes').select('*').eq('modelo_id', m.id).order('numero')
    const list = (data ?? []) as Revisao[]
    setRevisoes(list)
    setRevSel(list[0] ?? null)
  }, [supabase])

  const carregarItens = useCallback(async (revisaoId: number) => {
    const { data } = await supabase
      .from('rev_revisao_itens')
      .select('*, mercadoria:rev_mercadorias(*)')
      .eq('revisao_id', revisaoId)
      .order('id')
    setItens((data ?? []) as Item[])
  }, [supabase])

  useEffect(() => { if (revSel) carregarItens(revSel.id) }, [revSel, carregarItens])

  const carregarItensAvulso = useCallback(async (servicoId: number) => {
    const { data } = await supabase
      .from('rev_servico_itens')
      .select('*, mercadoria:rev_mercadorias(*)')
      .eq('servico_id', servicoId)
      .order('id')
    setItensAvulso((data ?? []) as Item[])
  }, [supabase])

  useEffect(() => { if (avulsoSel) carregarItensAvulso(avulsoSel.id) }, [avulsoSel, carregarItensAvulso])

  // busca no catálogo
  useEffect(() => {
    const t = catBusca.trim()
    if (t.length < 2) { setCatResultados([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('rev_mercadorias')
        .select('*')
        .or(`codigo.ilike.%${t}%,descricao.ilike.%${t}%`)
        .order('descricao')
        .limit(50)
      setCatResultados((data ?? []) as Mercadoria[])
    }, 250)
    return () => clearTimeout(timer)
  }, [catBusca, supabase])

  // ─── gravações ─────────────────────────────────────────────────
  async function salvarRevisao(patch: Partial<Revisao>) {
    if (!revSel) return
    const novo = { ...revSel, ...patch }
    setRevSel(novo)
    setRevisoes((rs) => rs.map((r) => (r.id === novo.id ? novo : r)))
    const { error } = await supabase.from('rev_revisoes').update(patch).eq('id', revSel.id)
    aviso(error ? `Erro: ${error.message}` : 'Salvo')
  }

  async function salvarItem(tabela: string, item: Item, patch: Partial<Item>, avulso = false) {
    const upd = (list: Item[]) => list.map((i) => (i.id === item.id ? { ...i, ...patch } : i))
    if (avulso) setItensAvulso(upd); else setItens(upd)
    const { error } = await supabase.from(tabela).update(patch).eq('id', item.id)
    aviso(error ? `Erro: ${error.message}` : 'Salvo')
  }

  async function removerItem(tabela: string, item: Item, avulso = false) {
    if (!confirm('Remover esta mercadoria desta revisão/serviço? (o item continua no catálogo)')) return
    const { error } = await supabase.from(tabela).delete().eq('id', item.id)
    if (error) return aviso(`Erro: ${error.message}`)
    if (avulso) setItensAvulso((l) => l.filter((i) => i.id !== item.id))
    else setItens((l) => l.filter((i) => i.id !== item.id))
    aviso('Mercadoria removida')
  }

  async function adicionarMercadoria(m: Mercadoria, quantidade: number) {
    const alvoAvulso = aba === 'avulsos'
    if (alvoAvulso ? !avulsoSel : !revSel) return
    const tabela = alvoAvulso ? 'rev_servico_itens' : 'rev_revisao_itens'
    const payload = alvoAvulso
      ? { servico_id: avulsoSel!.id, mercadoria_id: m.id, quantidade }
      : { revisao_id: revSel!.id, mercadoria_id: m.id, quantidade }
    const { error } = await supabase.from(tabela).insert(payload)
    if (error) return aviso(`Erro: ${error.message}`)
    setAddAberto(false)
    setCatBusca('')
    if (alvoAvulso) carregarItensAvulso(avulsoSel!.id); else carregarItens(revSel!.id)
    aviso('Mercadoria adicionada')
  }

  async function criarMercadoria(codigo: string, descricao: string, valor: number | null) {
    const { data, error } = await supabase
      .from('rev_mercadorias')
      .insert({ codigo, descricao, valor_unitario: valor })
      .select()
      .single()
    if (error) { aviso(`Erro: ${error.message}`); return null }
    aviso('Mercadoria cadastrada no catálogo')
    return data as Mercadoria
  }

  async function salvarMercadoria(m: Mercadoria, patch: Partial<Mercadoria>) {
    setCatResultados((l) => l.map((x) => (x.id === m.id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('rev_mercadorias').update(patch).eq('id', m.id)
    aviso(error ? `Erro: ${error.message}` : 'Salvo')
  }

  async function criarServico(nome: string) {
    const { data, error } = await supabase
      .from('rev_servicos_avulsos')
      .insert({ nome, ordem: avulsos.length + 1 })
      .select()
      .single()
    if (error) return aviso(`Erro: ${error.message}`)
    setAvulsos((l) => [...l, data as ServicoAvulso])
    aviso('Serviço criado')
  }

  async function salvarServico(s: ServicoAvulso, patch: Partial<ServicoAvulso>) {
    const novo = { ...s, ...patch }
    setAvulsoSel(novo)
    setAvulsos((l) => l.map((x) => (x.id === s.id ? novo : x)))
    const { error } = await supabase.from('rev_servicos_avulsos').update(patch).eq('id', s.id)
    aviso(error ? `Erro: ${error.message}` : 'Salvo')
  }

  async function removerServico(s: ServicoAvulso) {
    if (!confirm(`Excluir o serviço "${s.nome}"?`)) return
    const { error } = await supabase.from('rev_servicos_avulsos').delete().eq('id', s.id)
    if (error) return aviso(`Erro: ${error.message}`)
    setAvulsos((l) => l.filter((x) => x.id !== s.id))
    setAvulsoSel(null)
    aviso('Serviço excluído')
  }

  const modelosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return t ? modelos.filter((m) => m.nome.toLowerCase().includes(t)) : modelos
  }, [modelos, busca])

  const totalPecas = (lista: Item[]) =>
    lista.reduce((s, i) => {
      const vu = i.valor_unitario ?? i.mercadoria?.valor_unitario ?? 0
      return s + vu * (i.quantidade ?? 0)
    }, 0)

  return (
    <div style={{ minHeight: '100vh', padding: '24px clamp(12px, 4vw, 40px)' }}>
      <header className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Painel administrativo — Valores e Mercadorias</h1>
          <p style={{ fontSize: 13, opacity: 0.7 }}>{userEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/revisoes" target="_blank" rel="noreferrer" style={btnGhost}>Ver JSON público</a>
          <button
            style={btnGhost}
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' })
              window.location.href = '/auth/login'
            }}
          >
            Sair
          </button>
        </div>
      </header>

      <nav className="flex gap-2" style={{ marginBottom: 16 }}>
        {([['revisoes', 'Revisões'], ['avulsos', 'Serviços avulsos'], ['catalogo', 'Catálogo de mercadorias']] as [Aba, string][]).map(
          ([k, label]) => (
            <button
              key={k}
              onClick={() => setAba(k)}
              style={{
                ...btnGhost,
                background: aba === k ? VERDE : 'transparent',
                color: aba === k ? '#fff' : 'inherit',
                borderColor: aba === k ? VERDE : 'rgba(127,127,127,.35)',
                fontWeight: 600,
              }}
            >
              {label}
            </button>
          )
        )}
      </nav>

      {msg && (
        <div style={{ ...card, padding: '8px 12px', marginBottom: 12, borderColor: VERDE, fontSize: 13 }}>{msg}</div>
      )}

      {aba === 'revisoes' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(220px, 300px) 1fr' }}>
          <aside style={{ ...card, padding: 12, maxHeight: '75vh', overflow: 'auto' }}>
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="Buscar modelo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {modelosFiltrados.map((m) => (
              <button
                key={m.id}
                onClick={() => { setModeloSel(m); carregarRevisoes(m) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                  background: modeloSel?.id === m.id ? `${VERDE}22` : 'transparent',
                  color: 'inherit',
                  fontWeight: modeloSel?.id === m.id ? 600 : 400,
                }}
              >
                {m.nome}
              </button>
            ))}
          </aside>

          <section style={{ ...card, padding: 16 }}>
            {!modeloSel && <p style={{ opacity: 0.7, fontSize: 14 }}>Selecione um modelo à esquerda.</p>}
            {modeloSel && (
              <>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{modeloSel.nome}</h2>
                <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
                  {revisoes.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRevSel(r)}
                      style={{
                        ...btnGhost,
                        background: revSel?.id === r.id ? VERDE : 'transparent',
                        color: revSel?.id === r.id ? '#fff' : 'inherit',
                        borderColor: revSel?.id === r.id ? VERDE : 'rgba(127,127,127,.35)',
                      }}
                    >
                      {r.numero}ª revisão
                    </button>
                  ))}
                </div>

                {revSel && (
                  <>
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
                      <label style={{ fontSize: 12 }}>
                        Km de referência
                        <input
                          style={inputStyle}
                          defaultValue={revSel.km ?? ''}
                          key={`km-${revSel.id}`}
                          onBlur={(e) => salvarRevisao({ km: num(e.target.value) })}
                        />
                      </label>
                      <label style={{ fontSize: 12 }}>
                        Meses
                        <input
                          style={inputStyle}
                          defaultValue={revSel.meses ?? ''}
                          key={`ms-${revSel.id}`}
                          onBlur={(e) => salvarRevisao({ meses: num(e.target.value) })}
                        />
                      </label>
                      <label style={{ fontSize: 12 }}>
                        Mão de obra (R$)
                        <input
                          style={inputStyle}
                          defaultValue={revSel.mao_de_obra_valor ?? ''}
                          key={`mo-${revSel.id}`}
                          disabled={revSel.mao_de_obra_gratis}
                          onBlur={(e) => salvarRevisao({ mao_de_obra_valor: num(e.target.value) })}
                        />
                      </label>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
                        <input
                          type="checkbox"
                          checked={revSel.mao_de_obra_gratis}
                          onChange={(e) => salvarRevisao({ mao_de_obra_gratis: e.target.checked })}
                        />
                        Mão de obra gratuita
                      </label>
                    </div>

                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>Mercadorias da revisão</h3>
                      <button style={btn} onClick={() => setAddAberto(true)}>+ Adicionar mercadoria</button>
                    </div>

                    <TabelaItens
                      itens={itens}
                      onSalvar={(item, patch) => salvarItem('rev_revisao_itens', item, patch)}
                      onRemover={(item) => removerItem('rev_revisao_itens', item)}
                    />

                    <p style={{ marginTop: 10, fontSize: 13 }}>
                      Total mercadorias: <strong>{fmtBRL(totalPecas(itens))}</strong> · Total com mão de obra:{' '}
                      <strong>{fmtBRL(totalPecas(itens) + (revSel.mao_de_obra_gratis ? 0 : revSel.mao_de_obra_valor ?? 0))}</strong>
                    </p>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {aba === 'avulsos' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(220px, 300px) 1fr' }}>
          <aside style={{ ...card, padding: 12 }}>
            {avulsos.map((s) => (
              <button
                key={s.id}
                onClick={() => setAvulsoSel(s)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, color: 'inherit',
                  background: avulsoSel?.id === s.id ? `${VERDE}22` : 'transparent',
                }}
              >
                {s.nome}
              </button>
            ))}
            <button
              style={{ ...btn, width: '100%', marginTop: 10 }}
              onClick={() => {
                const nome = prompt('Nome do serviço avulso:')
                if (nome?.trim()) criarServico(nome.trim())
              }}
            >
              + Novo serviço
            </button>
          </aside>

          <section style={{ ...card, padding: 16 }}>
            {!avulsoSel && <p style={{ opacity: 0.7, fontSize: 14 }}>Selecione um serviço avulso.</p>}
            {avulsoSel && (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3" style={{ marginBottom: 16 }}>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', flex: 1 }}>
                    <label style={{ fontSize: 12 }}>
                      Nome do serviço
                      <input
                        style={inputStyle}
                        key={`sn-${avulsoSel.id}`}
                        defaultValue={avulsoSel.nome}
                        onBlur={(e) => salvarServico(avulsoSel, { nome: e.target.value })}
                      />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      Mão de obra (R$)
                      <input
                        style={inputStyle}
                        key={`sv-${avulsoSel.id}`}
                        defaultValue={avulsoSel.mao_de_obra_valor ?? ''}
                        onBlur={(e) => salvarServico(avulsoSel, { mao_de_obra_valor: num(e.target.value) })}
                      />
                    </label>
                  </div>
                  <button style={btnGhost} onClick={() => removerServico(avulsoSel)}>Excluir serviço</button>
                </div>

                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600 }}>Mercadorias do serviço</h3>
                  <button style={btn} onClick={() => setAddAberto(true)}>+ Adicionar mercadoria</button>
                </div>

                <TabelaItens
                  itens={itensAvulso}
                  onSalvar={(item, patch) => salvarItem('rev_servico_itens', item, patch, true)}
                  onRemover={(item) => removerItem('rev_servico_itens', item, true)}
                />

                <p style={{ marginTop: 10, fontSize: 13 }}>
                  Total mercadorias: <strong>{fmtBRL(totalPecas(itensAvulso))}</strong> · Total com mão de obra:{' '}
                  <strong>{fmtBRL(totalPecas(itensAvulso) + (avulsoSel.mao_de_obra_valor ?? 0))}</strong>
                </p>
              </>
            )}
          </section>
        </div>
      )}

      {aba === 'catalogo' && (
        <section style={{ ...card, padding: 16 }}>
          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 12 }}>
            <input
              style={{ ...inputStyle, maxWidth: 360 }}
              placeholder="Buscar por código ou descrição..."
              value={catBusca}
              onChange={(e) => setCatBusca(e.target.value)}
            />
            <button
              style={btn}
              onClick={async () => {
                const codigo = prompt('Código da mercadoria:')?.trim()
                if (!codigo) return
                const descricao = prompt('Descrição:')?.trim()
                if (!descricao) return
                const valor = num(prompt('Valor unitário (R$):') ?? '')
                const nova = await criarMercadoria(codigo, descricao, valor)
                if (nova) { setCatBusca(codigo); }
              }}
            >
              + Nova mercadoria
            </button>
          </div>
          {catBusca.trim().length < 2 && <p style={{ fontSize: 13, opacity: 0.7 }}>Digite pelo menos 2 caracteres para buscar.</p>}
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {catResultados.map((m) => (
                <tr key={m.id} style={{ borderTop: '1px solid rgba(127,127,127,.2)' }}>
                  <td style={{ padding: 6, width: 140, fontFamily: 'monospace' }}>{m.codigo}</td>
                  <td style={{ padding: 6 }}>
                    <input style={inputStyle} defaultValue={m.descricao} onBlur={(e) => salvarMercadoria(m, { descricao: e.target.value })} />
                  </td>
                  <td style={{ padding: 6, width: 130 }}>
                    <input
                      style={inputStyle}
                      defaultValue={m.valor_unitario ?? ''}
                      onBlur={(e) => salvarMercadoria(m, { valor_unitario: num(e.target.value) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {addAberto && (
        <ModalAdicionar
          busca={catBusca}
          setBusca={setCatBusca}
          resultados={catResultados}
          onFechar={() => setAddAberto(false)}
          onAdicionar={adicionarMercadoria}
          onCriar={criarMercadoria}
        />
      )}
    </div>
  )
}

function TabelaItens({
  itens, onSalvar, onRemover,
}: {
  itens: Item[]
  onSalvar: (item: Item, patch: Partial<Item>) => void
  onRemover: (item: Item) => void
}) {
  if (itens.length === 0) return <p style={{ fontSize: 13, opacity: 0.7 }}>Nenhuma mercadoria vinculada.</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr style={{ textAlign: 'left', opacity: 0.7 }}>
            <th style={{ padding: 6, width: 130 }}>Código</th>
            <th style={{ padding: 6 }}>Descrição</th>
            <th style={{ padding: 6, width: 90 }}>Qtd</th>
            <th style={{ padding: 6, width: 120 }}>Valor unit.</th>
            <th style={{ padding: 6, width: 110 }}>Total</th>
            <th style={{ padding: 6, width: 50 }} />
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => {
            const vu = i.valor_unitario ?? i.mercadoria?.valor_unitario ?? null
            return (
              <tr key={i.id} style={{ borderTop: '1px solid rgba(127,127,127,.2)' }}>
                <td style={{ padding: 6, fontFamily: 'monospace' }}>{i.mercadoria?.codigo}</td>
                <td style={{ padding: 6 }}>
                  <input
                    style={inputStyle}
                    defaultValue={i.descricao ?? i.mercadoria?.descricao ?? ''}
                    onBlur={(e) => onSalvar(i, { descricao: e.target.value })}
                  />
                </td>
                <td style={{ padding: 6 }}>
                  <input
                    style={inputStyle}
                    defaultValue={i.quantidade}
                    onBlur={(e) => onSalvar(i, { quantidade: num(e.target.value) ?? 0 })}
                  />
                </td>
                <td style={{ padding: 6 }}>
                  <input
                    style={inputStyle}
                    defaultValue={vu ?? ''}
                    onBlur={(e) => onSalvar(i, { valor_unitario: num(e.target.value) })}
                  />
                </td>
                <td style={{ padding: 6 }}>{fmtBRL(vu == null ? null : vu * (i.quantidade ?? 0))}</td>
                <td style={{ padding: 6 }}>
                  <button style={{ ...btnGhost, padding: '4px 8px' }} onClick={() => onRemover(i)}>×</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ModalAdicionar({
  busca, setBusca, resultados, onFechar, onAdicionar, onCriar,
}: {
  busca: string
  setBusca: (v: string) => void
  resultados: Mercadoria[]
  onFechar: () => void
  onAdicionar: (m: Mercadoria, quantidade: number) => void
  onCriar: (codigo: string, descricao: string, valor: number | null) => Promise<Mercadoria | null>
}) {
  const [qtd, setQtd] = useState('1')
  const [novoCodigo, setNovoCodigo] = useState('')
  const [novaDesc, setNovaDesc] = useState('')
  const [novoValor, setNovoValor] = useState('')

  return (
    <div
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, background: 'var(--bg-panel, #fff)', padding: 18, width: 'min(640px, 100%)', maxHeight: '85vh', overflow: 'auto' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Adicionar mercadoria</h3>

        <label style={{ fontSize: 12 }}>
          Quantidade usada
          <input style={{ ...inputStyle, marginBottom: 10 }} value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </label>

        <input
          style={{ ...inputStyle, marginBottom: 10 }}
          placeholder="Buscar no catálogo (código ou descrição)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoFocus
        />
        <div style={{ maxHeight: 220, overflow: 'auto', marginBottom: 14 }}>
          {resultados.map((m) => (
            <button
              key={m.id}
              onClick={() => onAdicionar(m, num(qtd) ?? 1)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid rgba(127,127,127,.15)' }}
            >
              <span style={{ fontFamily: 'monospace' }}>{m.codigo}</span> — {m.descricao}{' '}
              <strong>{fmtBRL(m.valor_unitario)}</strong>
            </button>
          ))}
        </div>

        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>Cadastrar mercadoria nova</summary>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))' }}>
            <input style={inputStyle} placeholder="Código" value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} />
            <input style={inputStyle} placeholder="Descrição" value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} />
            <input style={inputStyle} placeholder="Valor unitário" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
          </div>
          <button
            style={{ ...btn, marginTop: 10 }}
            onClick={async () => {
              if (!novoCodigo.trim() || !novaDesc.trim()) return
              const nova = await onCriar(novoCodigo.trim(), novaDesc.trim(), num(novoValor))
              if (nova) onAdicionar(nova, num(qtd) ?? 1)
            }}
          >
            Cadastrar e adicionar
          </button>
        </details>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button style={btnGhost} onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
