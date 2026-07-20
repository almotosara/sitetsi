'use client'

import { useMemo, useState } from 'react'
import type { Lead } from '@/lib/types'
import { STATUS_COLORS, ORIGEM_COLORS } from '@/lib/constants'

interface ReportViewProps {
  leads: Lead[]
}

function monthRange() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  return {
    de: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    ate: `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`,
  }
}

const INP: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)',
  padding: '8px 11px', borderRadius: 9, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

export function ReportView({ leads }: ReportViewProps) {
  const [range, setRange] = useState(monthRange)

  const filtered = useMemo(() => leads.filter((l) => {
    if (!l.data) return false
    if (range.de && l.data < range.de) return false
    if (range.ate && l.data > range.ate) return false
    return true
  }), [leads, range])

  const byOrigem = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach((l) => { m[l.origem] = (m[l.origem] || 0) + 1 })
    return m
  }, [filtered])

  const byStatus = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach((l) => { m[l.status] = (m[l.status] || 0) + 1 })
    return m
  }, [filtered])

  const byDay = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach((l) => { if (l.data && l.status === 'Convertido') m[l.data] = (m[l.data] || 0) + 1 })
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const maxDay = Math.max(...byDay.map(([, v]) => v), 1)
  const total = filtered.length
  const conv = byStatus['Convertido'] || 0
  const convRate = total > 0 ? ((conv / total) * 100).toFixed(1) : '0.0'

  return (
    <div className="view-enter flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Relatórios</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{total} leads no período selecionado</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={range.de} onChange={(e) => setRange((r) => ({ ...r, de: e.target.value }))} style={INP} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>até</span>
          <input type="date" value={range.ate} onChange={(e) => setRange((r) => ({ ...r, ate: e.target.value }))} style={INP} />
          <button onClick={() => setRange(monthRange())} style={{ ...INP, cursor: 'pointer', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
            Este mês
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KPICard label="Total" value={total} color="#ff4b2b" />
        <KPICard label="Convertidos" value={conv} color="#2fd675" sub={`${convRate}% taxa`} />
        <KPICard label="Bot WhatsApp" value={byOrigem['Bot WhatsApp'] || 0} color="#b083ff" />
        <KPICard label="Website" value={byOrigem['Website'] || 0} color="#4c8dff" />
      </div>

      {/* Charts row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* By day bar chart */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
          <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', borderLeft: '3px solid #2fd675', paddingLeft: 10, color: 'var(--text-primary)' }}>
            Convertidos por dia
          </h3>
          {byDay.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Nenhum lead convertido no período</p>
          ) : (
            <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
              {byDay.map(([d, v]) => {
                const h = (v / maxDay) * 100
                const [, m, day] = d.split('-')
                return (
                  <div key={d} className="flex flex-col items-center gap-1 min-w-[28px]" title={`${day}/${m}: ${v} convertido(s)`}>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{v}</span>
                    <div className="w-full flex items-end justify-center" style={{ height: 110 }}>
                      <div className="w-5 rounded-t-sm transition-all" style={{ height: `${h}%`, minHeight: 4, background: '#2fd675', opacity: 0.85 }} />
                    </div>
                    <span className="text-[9px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{day}/{m}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
          <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', borderLeft: '3px solid #ff4b2b', paddingLeft: 10, color: 'var(--text-primary)' }}>
            Por status
          </h3>
          <div className="flex flex-col gap-3">
            {['Novo', 'Em contato', 'Proposta enviada', 'Convertido', 'Perdido'].map((s) => {
              const count = byStatus[s] || 0
              const w = total > 0 ? (count / total) * 100 : 0
              const c = STATUS_COLORS[s]
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-dim)' }}>{s}</span>
                    <span className="font-bold" style={{ color: c.text }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${w}%`, background: c.text }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-line-soft)' }}>
            <p className="text-[11px] uppercase tracking-widest font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Por origem</p>
            {Object.entries(ORIGEM_COLORS).map(([o, c]) => (
              <div key={o} className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5" style={{ color: c.text }}>
                  <span className="w-2 h-2 rounded-sm" style={{ background: c.text }} />
                  {o}
                </span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{byOrigem[o] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="rounded-2xl px-5 py-4 flex flex-col gap-1.5 transition-shadow hover:shadow-lg" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
      <p className="text-[11.5px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 32, fontWeight: 700, lineHeight: 1, color }}>{value}</p>
      {sub && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}