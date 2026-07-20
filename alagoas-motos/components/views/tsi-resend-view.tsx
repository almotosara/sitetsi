'use client'

import { useState, useMemo } from 'react'
import type { TsiResendRow } from '@/lib/types'

interface TsiResendViewProps {
  data: TsiResendRow[]
  onImport: () => void
  onMarkSent: (id: string, data_reenvio: string | null) => void
}

const INP: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)',
  padding: '9px 12px', borderRadius: 9, fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
}

export function TsiResendView({ data, onImport, onMarkSent }: TsiResendViewProps) {
  const [q, setQ] = useState('')
  const [pendFilter, setPendFilter] = useState('')

  const filtered = useMemo(() => data.filter((r) => {
    const text = q.toLowerCase()
    if (text &&
      !r.os.toLowerCase().includes(text) &&
      !(r.cliente || '').toLowerCase().includes(text) &&
      !(r.veiculo || '').toLowerCase().includes(text)) return false
    if (pendFilter === 'pendente' && r.data_reenvio) return false
    if (pendFilter === 'reenviado' && !r.data_reenvio) return false
    return true
  }), [data, q, pendFilter])

  const pendentes = data.filter((r) => !r.data_reenvio).length

  return (
    <div className="view-enter flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Reenvio de Pesquisas</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{filtered.length} de {data.length} registros · {pendentes} pendente{pendentes !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onImport} className="flex items-center gap-1.5 px-4 py-2 rounded-[9px] text-white font-semibold text-[13.5px] cursor-pointer hover:brightness-110 transition-all"
          style={{ background: 'linear-gradient(135deg, #0f7a5a, #065f46)', border: '1px solid #0f7a5a', boxShadow: '0 6px 16px -6px #0f7a5a70' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>
          Importar planilha
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar OS, cliente, veículo…" className="w-full" style={{ ...INP, paddingLeft: 36 }} />
        </div>
        <select value={pendFilter} onChange={(e) => setPendFilter(e.target.value)} style={{ ...INP, minWidth: 155 }}>
          <option value="">Todos</option>
          <option value="pendente">Pendentes de reenvio</option>
          <option value="reenviado">Já reenviados</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16" style={{ color: 'var(--text-muted)' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2.5 opacity-35"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>
            <p className="text-sm">{data.length === 0 ? 'Nenhuma planilha de reenvio importada' : 'Nenhum resultado encontrado'}</p>
            {data.length === 0 && (
              <button onClick={onImport} className="mt-3 text-xs text-[#0f7a5a] hover:underline cursor-pointer">
                Importar planilha de reenvio
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['O.S.', 'Cliente', 'Veículo', 'E-mail', 'Celular', 'Envio e-mail', 'Envio SMS', 'Reenvio', ''].map((h) => (
                    <th key={h} className="text-left px-3.5 py-2.5 text-[10.5px] uppercase tracking-widest font-bold whitespace-nowrap"
                      style={{ background: 'var(--bg-panel-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-line-soft)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="transition-colors last:border-0"
                    style={{ borderBottom: '1px solid var(--border-line-soft)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-panel-2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <td className="px-3.5 py-2.5 font-mono text-xs" style={{ color: 'var(--text-dim)' }}>{r.os}</td>
                    <td className="px-3.5 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{r.cliente || '—'}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{r.veiculo || '—'}</td>
                    <td className="px-3.5 py-2.5" style={{ color: 'var(--text-dim)' }}>{r.email || '—'}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{r.celular || '—'}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.data_envio_email || '—'}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.data_envio_sms || '—'}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      {r.data_reenvio ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#0f7a5a26', color: '#0f7a5a' }}>
                          {r.data_reenvio}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#ffc40026', color: '#b98600' }}>
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      {!r.data_reenvio ? (
                        <button
                          onClick={() => onMarkSent(r.id, new Date().toLocaleDateString('pt-BR'))}
                          className="text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:brightness-110"
                          style={{ background: '#0f7a5a', color: '#fff' }}
                        >
                          Marcar reenviado
                        </button>
                      ) : (
                        <button
                          onClick={() => onMarkSent(r.id, null)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:opacity-80"
                          style={{ border: '1px solid var(--border-line)', color: 'var(--text-dim)', background: 'transparent' }}
                        >
                          Desfazer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
