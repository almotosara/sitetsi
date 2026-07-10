'use client'

import { useState, useMemo } from 'react'
import type { TsiRow } from '@/lib/types'
import { TSI_STORE_MAP, tsiColor } from '@/lib/constants'

interface TsiListViewProps {
  tsiData: TsiRow[]
  onImport: () => void
}

const INP: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)',
  padding: '9px 12px', borderRadius: 9, fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
}

export function TsiListView({ tsiData, onImport }: TsiListViewProps) {
  const [q, setQ] = useState('')
  const [lojaFilter, setLojaFilter] = useState('')
  const [faixa, setFaixa] = useState('')

  const lojas = useMemo(() => {
    const s = new Set<string>()
    tsiData.forEach((r) => s.add(TSI_STORE_MAP[r.loja || ''] || r.loja || 'Outros'))
    return Array.from(s).sort()
  }, [tsiData])

  const filtered = useMemo(() => tsiData.filter((r) => {
    const text = q.toLowerCase()
    const lojaNome = TSI_STORE_MAP[r.loja || ''] || r.loja || 'Outros'
    if (text && !r.os.toLowerCase().includes(text) && !lojaNome.toLowerCase().includes(text) && !r.comentario?.toLowerCase().includes(text)) return false
    if (lojaFilter && lojaNome !== lojaFilter) return false
    if (faixa) {
      const t2b = Number(r.t2b ?? 0)
      if (faixa === 'verde' && t2b < 93.5) return false
      if (faixa === 'amarelo' && (t2b >= 93.5 || t2b < 92)) return false
      if (faixa === 'vermelho' && t2b >= 92) return false
    }
    return true
  }), [tsiData, q, lojaFilter, faixa])

  const colors = { green: '#2fd675', yellow: '#ffc400', red: '#ff5a5f' }

  return (
    <div className="view-enter flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Pesquisas TSI</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{filtered.length} de {tsiData.length} registros</p>
        </div>
        <button onClick={onImport} className="flex items-center gap-1.5 px-4 py-2 rounded-[9px] text-white font-semibold text-[13.5px] cursor-pointer hover:brightness-110 transition-all"
          style={{ background: 'linear-gradient(135deg, #ff4b2b, #d63a1e)', border: '1px solid #ff4b2b', boxShadow: '0 6px 16px -6px #ff4b2b70' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>
          Importar TSI
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar OS, comentário…" className="pl-9 w-full" style={INP} />
        </div>
        <select value={lojaFilter} onChange={(e) => setLojaFilter(e.target.value)} style={{ ...INP, minWidth: 155 }}>
          <option value="">Todas as lojas</option>
          {lojas.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select value={faixa} onChange={(e) => setFaixa(e.target.value)} style={{ ...INP, minWidth: 130 }}>
          <option value="">Todas as faixas</option>
          <option value="verde">Acima da meta</option>
          <option value="amarelo">Atenção</option>
          <option value="vermelho">Abaixo</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16" style={{ color: 'var(--text-muted)' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2.5 opacity-35"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            <p className="text-sm">{tsiData.length === 0 ? 'Nenhuma planilha TSI importada' : 'Nenhum resultado encontrado'}</p>
            {tsiData.length === 0 && (
              <button onClick={onImport} className="mt-3 text-xs text-[#ff4b2b] hover:underline cursor-pointer">
                Importar planilha TSI
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['Loja', 'O.S.', 'Top2Box', 'TSI', 'Data', 'Comentário'].map((h) => (
                    <th key={h} className="text-left px-3.5 py-2.5 text-[10.5px] uppercase tracking-widest font-bold whitespace-nowrap"
                      style={{ background: 'var(--bg-panel-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-line-soft)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const lojaNome = TSI_STORE_MAP[r.loja || ''] || r.loja || 'Outros'
                  const t2b = Number(r.t2b ?? 0)
                  const tsi = Number(r.tsi ?? 0)
                  const tc = tsiColor(t2b)
                  const tColor = colors[tc as keyof typeof colors]
                  return (
                    <tr key={r.id} className="transition-colors last:border-0"
                      style={{ borderBottom: '1px solid var(--border-line-soft)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-panel-2)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <td className="px-3.5 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{lojaNome}</td>
                      <td className="px-3.5 py-2.5 font-mono text-xs" style={{ color: 'var(--text-dim)' }}>{r.os}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: tColor + '26', color: tColor }}>
                          {t2b.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5" style={{ color: 'var(--text-dim)' }}>{tsi.toFixed(2)}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{r.data || '—'}</td>
                      <td className="px-3.5 py-2.5 max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>{r.comentario || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}