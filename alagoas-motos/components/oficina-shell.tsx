'use client'

import { useEffect, useMemo, useState } from 'react'
import { OficinaSidebar } from './oficina-sidebar'

interface Peca { descricao: string; codigo: string | null; valor_unitario: number | null; quantidade: number | null; total: number | null }
interface Servico { servico: string; acao: string }
interface Revisao {
  numero: number; km: number; meses: number | null; tmo_horas: number | null
  pecas: Peca[]; servicos: Servico[]
  pecas_total: number; mao_de_obra_gratis: boolean; mao_de_obra_valor: number | null; total: number
}
interface Modelo { modelo: string; periodo: string; revisoes: Revisao[] }
interface MaoDeObraRow { modelos: string; tmo_hora_valor: number }
interface ValorItem { codigo: string; descricao: string; valor: number }
interface RevisoesData { modelos: Modelo[]; mao_de_obra: MaoDeObraRow[]; valores_mercadoria: ValorItem[] }

type Tab = 'revisao' | 'valores' | 'maodeobra' | 'manuais'

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Cruzamento aproximado modelo → grupo de mão de obra ──────────────────────
function normTok(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
function wordsOf(s: string) {
  return s.toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length >= 2)
}
const STOP_WORDS = new Set(['DE', 'DA', 'DO'])
function baseModelo(modelo: string) {
  return modelo
    .replace(/\(.*?\)/g, ' ')
    .split(/\s-\s/)[0]       // só separa em dash COM espaços dos 2 lados (não corta nomes como "X-ADV")
    .split('•')[0]
    .replace(/\b(19|20)\d{2}\b/g, '')
    .trim()
}
// Passo 1: tenta achar token igual/mais específico (normalizado, sem espaços/acentos)
function findGrupoPorToken(modelo: string, grupos: MaoDeObraRow[]): MaoDeObraRow | null {
  const base = normTok(baseModelo(modelo))
  const baseClean = base.replace(/I$/, '')
  let best: MaoDeObraRow | null = null
  let bestLen = 0
  for (const g of grupos) {
    const tokens = g.modelos.split('/').map((t) => normTok(t)).filter(Boolean)
    for (const t of tokens) {
      const tClean = t.replace(/I$/, '')
      if (tClean === baseClean) return g // match exato tem prioridade máxima
      if (base.includes(t) || t.includes(base) || base.includes(tClean) || tClean.includes(baseClean)) {
        if (tClean.length > bestLen) { bestLen = tClean.length; best = g } // prefere o token mais específico
      }
    }
  }
  return best
}
// Passo 2 (fallback): sobreposição de palavras, para nomes reordenados (ex: "CB 500 Hornet" ↔ "HORNET 500")
function findGrupoPorPalavras(modelo: string, grupos: MaoDeObraRow[]): MaoDeObraRow | null {
  const baseWords = wordsOf(baseModelo(modelo)).filter((w) => !STOP_WORDS.has(w))
  let best: MaoDeObraRow | null = null
  let bestScore = 0
  for (const g of grupos) {
    const gw = wordsOf(g.modelos)
    let score = 0
    for (const bw of baseWords) {
      for (const w of gw) {
        if (bw === w) score += 2
        else if (/^\d/.test(bw) && /^\d/.test(w) && (bw.startsWith(w) || w.startsWith(bw))) score += 1
      }
    }
    if (score > bestScore) { bestScore = score; best = g }
  }
  return bestScore > 0 ? best : null
}
function findGrupoMaoDeObra(modelo: string, grupos: MaoDeObraRow[]): MaoDeObraRow | null {
  return findGrupoPorToken(modelo, grupos) || findGrupoPorPalavras(modelo, grupos)
}
function estimarMaoDeObra(revisao: Revisao, modelo: string, grupos: MaoDeObraRow[]): { valor: number | null; estimado: boolean } {
  if (revisao.mao_de_obra_gratis) return { valor: null, estimado: false }
  if (revisao.mao_de_obra_valor != null) return { valor: revisao.mao_de_obra_valor, estimado: false }
  if (revisao.tmo_horas == null) return { valor: null, estimado: false }
  const grupo = findGrupoMaoDeObra(modelo, grupos)
  if (!grupo) return { valor: null, estimado: false }
  return { valor: revisao.tmo_horas * grupo.tmo_hora_valor, estimado: true }
}

// ─── Highlight do termo buscado ─────────────────────────────────────────────
function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim()
  if (!t) return <>{text}</>
  const idx = text.toLowerCase().indexOf(t.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#0f7a5a3a', color: 'inherit', borderRadius: 3, padding: '0 2px' }}>
        {text.slice(idx, idx + t.length)}
      </mark>
      {text.slice(idx + t.length)}
    </>
  )
}

function Skeleton() {
  const pulse: React.CSSProperties = { background: 'var(--bg-panel-2)', borderRadius: 8, animation: 'oficina-pulse 1.4s ease-in-out infinite' }
  return (
    <div className="flex flex-col gap-4">
      <style>{`@keyframes oficina-pulse{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
      <div style={{ ...pulse, height: 38, width: 320 }} />
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ ...pulse, height: 62, animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
    </div>
  )
}

export function OficinaShell({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [tab, setTab] = useState<Tab>('revisao')
  const [data, setData] = useState<RevisoesData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [q, setQ] = useState('')
  const [selectedModelo, setSelectedModelo] = useState<Modelo | null>(null)
  const [revisaoIdx, setRevisaoIdx] = useState(0)
  const [qValores, setQValores] = useState('')

  useEffect(() => {
    fetch('/data/revisoes.json')
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((json: RevisoesData) => setData(json))
      .catch(() => setLoadError(true))
  }, [])

  const modelosFiltrados = useMemo(() => {
    if (!data) return []
    const text = q.trim().toLowerCase()
    if (!text) return data.modelos
    return data.modelos.filter((m) => m.modelo.toLowerCase().includes(text))
  }, [data, q])

  const valoresFiltrados = useMemo(() => {
    if (!data) return []
    const text = qValores.trim().toLowerCase()
    if (!text) return []
    return data.valores_mercadoria.filter(
      (v) => v.descricao.toLowerCase().includes(text) || v.codigo.toLowerCase().includes(text)
    )
  }, [data, qValores])

  const revisaoAtual = selectedModelo?.revisoes[revisaoIdx] ?? null

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      <OficinaSidebar
        view={tab}
        onView={setTab}
        userName={userName}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 p-6 pb-16 max-w-[1200px] w-full mx-auto">
        <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
          {tab === 'revisao' && 'Consulta de Revisão'}
          {tab === 'valores' && 'Consulta de Valores'}
          {tab === 'maodeobra' && 'Tabela de Mão de Obra'}
          {tab === 'manuais' && 'Manuais Honda'}
        </h1>
        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
          {tab === 'revisao' && 'Selecione o modelo da moto para ver peças, serviços e TMO de cada revisão.'}
          {tab === 'valores' && 'Busque uma peça ou kit por código ou descrição na tabela de mercadoria.'}
          {tab === 'maodeobra' && 'Valor de referência da mão de obra por hora, por grupo de modelo.'}
          {tab === 'manuais' && 'Manuais completos de tabelas de manutenção para consulta.'}
        </p>

        {loadError && (
          <div className="rounded-xl p-4 text-sm" style={{ background: '#ff5a5f1a', border: '1px solid #ff5a5f40', color: '#ff5a5f' }}>
            Não foi possível carregar os dados de revisão. Recarregue a página.
          </div>
        )}

        {!data && !loadError && <Skeleton />}

        {data && tab === 'revisao' && (
          <div className="flex flex-col gap-4">
            <input
              value={q} onChange={(e) => { setQ(e.target.value); setSelectedModelo(null) }}
              placeholder="Buscar modelo (ex: CB 300, POP 110, ADV 160)…"
              className="w-full max-w-md"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 9, fontSize: 13.5, outline: 'none' }}
            />

            {!selectedModelo && (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {modelosFiltrados.map((m) => (
                  <button key={m.modelo} onClick={() => { setSelectedModelo(m); setRevisaoIdx(0) }}
                    className="text-left rounded-xl px-4 py-3 cursor-pointer transition-colors"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
                    <div className="font-semibold text-[13.5px]" style={{ color: 'var(--text-primary)' }}><Highlight text={m.modelo} term={q} /></div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.periodo} · {m.revisoes.length} revisões</div>
                  </button>
                ))}
                {modelosFiltrados.length === 0 && (
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum modelo encontrado.</div>
                )}
              </div>
            )}

            {selectedModelo && revisaoAtual && (
              <div className="flex flex-col gap-4">
                <button onClick={() => setSelectedModelo(null)} className="self-start text-[12.5px] font-semibold cursor-pointer" style={{ color: '#0f7a5a' }}>
                  ← Voltar aos modelos
                </button>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 19, fontWeight: 700 }}>
                  <Highlight text={selectedModelo.modelo} term={q} />
                </h2>

                {/* Abas de revisão (1ª, 2ª, 3ª...) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
                  {selectedModelo.revisoes.map((r, i) => (
                    <button key={r.numero} onClick={() => setRevisaoIdx(i)}
                      className="flex-shrink-0 px-3.5 py-2 text-[12.5px] font-bold cursor-pointer rounded-t-[9px] transition-colors"
                      style={{
                        color: revisaoIdx === i ? '#0f7a5a' : 'var(--text-muted)',
                        background: revisaoIdx === i ? 'var(--card-bg)' : 'transparent',
                        borderBottom: revisaoIdx === i ? '2px solid #0f7a5a' : '2px solid transparent',
                        marginBottom: -1,
                      }}>
                      {r.numero}ª · {r.km.toLocaleString('pt-BR')}km
                    </button>
                  ))}
                </div>

                {(() => {
                  const r = revisaoAtual
                  const { valor: maoDeObraCalc, estimado } = estimarMaoDeObra(r, selectedModelo.modelo, data.mao_de_obra)
                  const maoDeObraFinal = r.mao_de_obra_gratis ? null : (r.mao_de_obra_valor ?? maoDeObraCalc)
                  const totalFinal = r.mao_de_obra_gratis ? r.pecas_total : (r.mao_de_obra_valor != null ? r.total : r.pecas_total + (maoDeObraFinal ?? 0))
                  return (
                    <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16, fontWeight: 700, margin: 0 }}>
                          {r.numero}ª Revisão — {r.km.toLocaleString('pt-BR')} km{r.meses ? ` ou ${r.meses} meses` : ''}
                        </h3>
                        {r.tmo_horas != null && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#0f7a5a26', color: '#0f7a5a' }}>
                            TMO: {r.tmo_horas}h
                          </span>
                        )}
                      </div>

                      {r.servicos.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {r.servicos.map((s, i) => (
                            <span key={i} title={s.acao} className="text-[11px] px-2 py-1 rounded-full" style={{ background: 'var(--bg-panel-2)', color: 'var(--text-dim)', border: '1px solid var(--border-line-soft)' }}>
                              {s.servico}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-[12.5px] border-collapse">
                          <thead>
                            <tr>
                              {['Peça', 'Código', 'Valor unit.', 'Qtd.', 'Total'].map((h, i) => (
                                <th key={h} className="px-2 py-1.5 text-[10px] uppercase tracking-widest font-bold" style={{ textAlign: i === 0 ? 'left' : 'right', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-line-soft)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {r.pecas.map((p, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
                                <td className="px-2 py-1.5">{p.descricao}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{p.codigo || '—'}</td>
                                <td className="px-2 py-1.5 text-right">{fmtBRL(p.valor_unitario)}</td>
                                <td className="px-2 py-1.5 text-right">{p.quantidade ?? '—'}</td>
                                <td className="px-2 py-1.5 text-right font-semibold">{fmtBRL(p.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-end items-center gap-6 mt-3 pt-3 text-[12.5px] flex-wrap" style={{ borderTop: '1px solid var(--border-line-soft)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Peças: <b style={{ color: 'var(--text-primary)' }}>{fmtBRL(r.pecas_total)}</b></span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Mão de obra:{' '}
                          <b style={{ color: 'var(--text-primary)' }}>{r.mao_de_obra_gratis ? 'Grátis' : fmtBRL(maoDeObraFinal)}</b>
                          {estimado && (
                            <span className="ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#ffb02e26', color: '#ffb02e' }} title="Calculado a partir do TMO × valor/hora do grupo, planilha não trazia o valor oficial">
                              estimado
                            </span>
                          )}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>Total: <b style={{ color: '#0f7a5a' }}>{fmtBRL(totalFinal)}</b></span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {data && tab === 'valores' && (
          <div className="flex flex-col gap-4">
            <input
              value={qValores} onChange={(e) => setQValores(e.target.value)}
              placeholder="Buscar por código ou descrição (ex: KIT REVISAO, 0113AKRE306)…"
              className="w-full max-w-md"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 9, fontSize: 13.5, outline: 'none' }}
            />

            {!qValores.trim() && (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Digite algo para buscar entre {data.valores_mercadoria.length.toLocaleString('pt-BR')} itens da tabela de mercadoria.
              </div>
            )}

            {qValores.trim() && (
              <>
                <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                  {valoresFiltrados.length === 0
                    ? 'Nenhum item encontrado.'
                    : `Mostrando ${Math.min(50, valoresFiltrados.length)} de ${valoresFiltrados.length} resultado(s)${valoresFiltrados.length > 50 ? ' — refine a busca para ver outros' : ''}`}
                </div>
                <div className="overflow-x-auto rounded-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
                  <table className="w-full text-[13px] border-collapse">
                    <thead>
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[10.5px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)', background: 'var(--bg-panel-2)' }}>Código</th>
                        <th className="px-4 py-2.5 text-left text-[10.5px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)', background: 'var(--bg-panel-2)' }}>Descrição</th>
                        <th className="px-4 py-2.5 text-right text-[10.5px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)', background: 'var(--bg-panel-2)' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valoresFiltrados.slice(0, 50).map((v, i) => (
                        <tr key={v.codigo + i} style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
                          <td className="px-4 py-2 font-mono text-[11.5px]" style={{ color: 'var(--text-muted)' }}><Highlight text={v.codigo} term={qValores} /></td>
                          <td className="px-4 py-2 font-semibold"><Highlight text={v.descricao} term={qValores} /></td>
                          <td className="px-4 py-2 text-right">{fmtBRL(v.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {data && tab === 'maodeobra' && (
          <div className="overflow-x-auto rounded-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10.5px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)', background: 'var(--bg-panel-2)' }}>Grupo de modelos</th>
                  <th className="px-4 py-2.5 text-right text-[10.5px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)', background: 'var(--bg-panel-2)' }}>Valor / hora</th>
                </tr>
              </thead>
              <tbody>
                {data.mao_de_obra.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
                    <td className="px-4 py-2.5 font-semibold">{row.modelos}</td>
                    <td className="px-4 py-2.5 text-right">{fmtBRL(row.tmo_hora_valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'manuais' && (
          <div className="flex flex-col gap-3">
            {[
              { href: '/docs/manual-manutencao-2024-atual.pdf', label: 'Manual de Tabelas de Manutenção — 2024 em diante' },
              { href: '/docs/manual-manutencao-2016-2024.pdf', label: 'Manual de Tabelas de Manutenção — 2016 a 2024' },
            ].map((doc) => (
              <a key={doc.href} href={doc.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-colors"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
                <IconPdf />
                <div className="flex-1">
                  <div className="font-semibold text-[13.5px]">{doc.label}</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Abrir / baixar PDF</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function IconPdf() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f7a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> }
