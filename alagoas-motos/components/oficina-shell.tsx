'use client'

import { useEffect, useMemo, useState } from 'react'
import { OficinaSidebar } from './oficina-sidebar'
import { ChatPanel } from './chat-panel'
import { MotosView } from './oficina/motos-view'
import { FooterLojas } from './oficina/footer-lojas'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

interface Peca { descricao: string; codigo: string | null; valor_unitario: number | null; quantidade: number | null; total: number | null }
interface Servico { servico: string; acao: string }
interface Revisao {
  numero: number; km: number; meses: number | null; tmo_horas: number | null
  pecas: Peca[]; servicos: Servico[]
  pecas_total: number; mao_de_obra_gratis: boolean; mao_de_obra_valor: number | null; total: number
}
interface Modelo { modelo: string; periodo: string; revisoes: Revisao[] }
interface MaoDeObraRow { modelos: string; tmo_hora_valor: number; revisao_geral_valor: number | null }
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

export function OficinaShell({ userName, userEmail, userId }: { userName: string; userEmail: string; userId: string }) {
  const [tab, setTab] = useState<Tab>('revisao')
  const [chatOpen, setChatOpen] = useState(false)
  const [data, setData] = useState<RevisoesData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [q, setQ] = useState('')
  const [selectedModelo, setSelectedModelo] = useState<Modelo | null>(null)
  const [revisaoIdx, setRevisaoIdx] = useState(0)
  const [qValores, setQValores] = useState('')

  // Dados vem do banco (painel administrativo) via endpoint publico /api/revisoes,
  // com atualizacao em tempo real quando o admin salva algum valor.
  useEffect(() => {
    let ativo = true
    const carregar = () =>
      fetch('/api/revisoes', { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error(); return r.json() })
        .then((json: RevisoesData) => { if (ativo) setData(json) })
        .catch(() => { if (ativo) setLoadError(true) })

    carregar()

    const supabase = createSupabaseClient()
    const channel = supabase.channel('rev-valores')
    for (const table of [
      'rev_modelos', 'rev_revisoes', 'rev_mercadorias', 'rev_revisao_itens',
      'rev_servicos_avulsos', 'rev_servico_itens', 'rev_mao_de_obra',
    ]) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => carregar())
    }
    channel.subscribe()

    return () => { ativo = false; supabase.removeChannel(channel) }
  }, [])

  // Modelos mais populares na oficina aparecem primeiro quando nao ha busca
  const MODELOS_POPULARES = ['POP', 'BIZ', 'BROS', 'CG']
  function prioridadePopular(modelo: string): number {
    const upper = modelo.toUpperCase()
    const idx = MODELOS_POPULARES.findIndex((p) => upper.includes(p))
    return idx === -1 ? MODELOS_POPULARES.length : idx
  }

  const modelosFiltrados = useMemo(() => {
    if (!data) return []
    const text = q.trim().toLowerCase()
    if (!text) {
      return [...data.modelos].sort((a, b) => prioridadePopular(a.modelo) - prioridadePopular(b.modelo))
    }
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
    <div className="oficina-page flex min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      <OficinaSidebar
        view={tab}
        onView={setTab}
        userName={userName}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 p-6 pb-16 max-w-[1200px] w-full mx-auto">
        <h1 style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          {tab === 'revisao' && 'Motos & Ordem de Serviço'}
          {tab === 'valores' && 'Consulta de Valores'}
          {tab === 'maodeobra' && 'Tabela de Mão de Obra'}
          {tab === 'manuais' && 'Manuais Honda'}
        </h1>
        <p className="text-[12.5px] font-medium mb-6" style={{ color: 'var(--text-muted)' }}>
          {tab === 'revisao' && 'Escolha a moto para abrir a ordem de serviço no MicroWork ou ver os valores de cada revisão.'}
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

        {data && tab === 'revisao' && <MotosView data={data as never} />}

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
                  <th className="px-4 py-2.5 text-right text-[10.5px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)', background: 'var(--bg-panel-2)' }}>T.M.O hora</th>
                  <th className="px-4 py-2.5 text-right text-[10.5px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)', background: 'var(--bg-panel-2)' }}>Revisão geral</th>
                </tr>
              </thead>
              <tbody>
                {data.mao_de_obra.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
                    <td className="px-4 py-2.5 font-semibold">{row.modelos}</td>
                    <td className="px-4 py-2.5 text-right">{fmtBRL(row.tmo_hora_valor)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtBRL(row.revisao_geral_valor)}</td>
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

        <FooterLojas />
      </div>

      {/* Botão flutuante de chat com o Consultor */}
      <button
        onClick={() => setChatOpen(true)}
        title="Chat com o Consultor"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 z-30"
        style={{ background: '#0f7a5a', color: '#fff', boxShadow: '0 10px 30px -8px #0f7a5a99' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} myUserId={userId} myName={userName} />
    </div>
  )
}

function IconPdf() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f7a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> }
