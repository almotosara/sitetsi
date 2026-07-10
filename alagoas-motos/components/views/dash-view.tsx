'use client'

import { useMemo } from 'react'
import type { Lead } from '@/lib/types'
import { STATUS_COLORS, ORIGEM_COLORS, fmtDate } from '@/lib/constants'
import BorderGlow from '@/components/border-glow'

interface DashViewProps {
  leads: Lead[]
  goal: number
  onGoalChange: (g: number) => void
  onView: (v: string) => void
  onNewLead: () => void
}

export function DashView({ leads, goal, onGoalChange, onView, onNewLead }: DashViewProps) {
  const now = new Date()
  const monthLeads = useMemo(() => leads.filter((l) => {
    if (!l.data) return false
    const d = new Date(l.data + 'T12:00:00')
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }), [leads])

  const total = monthLeads.length
  const byOrigem = useMemo(() => {
    const m: Record<string, number> = {}
    monthLeads.forEach((l) => { m[l.origem] = (m[l.origem] || 0) + 1 })
    return m
  }, [monthLeads])
  const byStatus = useMemo(() => {
    const m: Record<string, number> = {}
    monthLeads.forEach((l) => { m[l.status] = (m[l.status] || 0) + 1 })
    return m
  }, [monthLeads])

  const convertidos = byStatus['Convertido'] || 0
  const perdidos = byStatus['Perdido'] || 0
  const pct = goal > 0 ? Math.min(100, (convertidos / goal) * 100) : 0

  const MONTH_NAME = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  const recent = leads.slice(0, 8)

  const R = 70; const ARC = Math.PI * R
  const filled = (pct / 100) * ARC
  const gColor = pct >= 100 ? '#2fd675' : pct >= 70 ? '#ffc400' : '#ff4b2b'

  return (
    <div className="view-enter flex flex-col gap-5">
      {/* Stats row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Total do mês" value={total} color="#ff4b2b" sub={MONTH_NAME}
          glowHSL="12 100 55" colors={['#ff4b2b', '#ff7849', '#ff9a76']} />
        <StatCard label="Bot WhatsApp" value={byOrigem['Bot WhatsApp'] || 0} color="#b083ff" sub="leads via WhatsApp"
          glowHSL="270 100 75" colors={['#b083ff', '#c9a0ff', '#7c5ce0']} />
        <StatCard label="Website" value={byOrigem['Website'] || 0} color="#4c8dff" sub="leads via site"
          glowHSL="218 100 65" colors={['#4c8dff', '#74a8ff', '#2d6be0']} />
        <StatCard label="Convertidos" value={convertidos} color="#2fd675" sub={`${perdidos} perdidos`}
          glowHSL="145 70 50" colors={['#2fd675', '#5ce89a', '#1ab855']} />
      </div>

      {/* Middle row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Funil por status */}
        <BorderGlow
          borderRadius={16}
          glowRadius={30}
          glowIntensity={0.8}
          glowColor="12 100 60"
          colors={['#ff4b2b', '#ffc400', '#ff7849']}
          animated
        >
          <div className="p-5">
            <p className="text-[11.5px] uppercase tracking-widest font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>Funil por status</p>
            <div className="flex flex-col gap-2.5">
              {['Novo', 'Em contato', 'Proposta enviada', 'Convertido', 'Perdido'].map((s) => {
                const count = byStatus[s] || 0
                const w = total > 0 ? (count / total) * 100 : 0
                const c = STATUS_COLORS[s]
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="text-xs w-[130px] flex-none" style={{ color: 'var(--text-muted)' }}>{s}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${w}%`, background: c.text }} />
                    </div>
                    <span className="text-xs font-bold w-6 text-right" style={{ color: c.text }}>{count}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-4 flex gap-4 flex-wrap" style={{ borderTop: '1px solid var(--border-line-soft)' }}>
              {Object.entries(ORIGEM_COLORS).map(([o, c]) => (
                <span key={o} className="flex items-center gap-1.5 text-xs" style={{ color: c.text }}>
                  <span className="w-2 h-2 rounded-sm" style={{ background: c.text }} />
                  {o}: <b>{byOrigem[o] || 0}</b>
                </span>
              ))}
            </div>
          </div>
        </BorderGlow>

        {/* Meta gauge */}
        <BorderGlow
          borderRadius={16}
          glowRadius={30}
          glowIntensity={0.8}
          glowColor={pct >= 100 ? '145 70 50' : pct >= 70 ? '45 100 60' : '12 100 55'}
          colors={pct >= 100 ? ['#2fd675', '#5ce89a', '#1ab855'] : pct >= 70 ? ['#ffc400', '#ffd54f', '#e6b000'] : ['#ff4b2b', '#ff7849', '#d63a1e']}
          animated
        >
          <div className="p-5 flex flex-col items-center">
            <p className="text-[11.5px] uppercase tracking-widest font-semibold mb-3 self-start" style={{ color: 'var(--text-muted)' }}>Meta mensal</p>
            <svg width="180" height="100" viewBox="0 0 180 100">
              <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="var(--bg-elevated)" strokeWidth="14" strokeLinecap="round" />
              <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke={gColor} strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${filled} ${ARC}`} strokeDashoffset={0}
                style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)' }} />
            </svg>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 40, fontWeight: 700, marginTop: -34, color: gColor, lineHeight: 1 }}>
              {convertidos}
            </div>
            <div className="text-[11.5px] uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>de {goal} convertidos</div>
            <div className="flex items-center gap-1.5 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Meta:</span>
              <input
                type="number" value={goal} min={1}
                onChange={(e) => onGoalChange(Number(e.target.value))}
                className="w-16 px-2 py-1 rounded-lg text-center text-sm font-bold outline-none"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-line)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => { (e.target as HTMLElement).style.borderColor = '#ff4b2b' }}
                onBlur={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border-line)' }}
              />
            </div>
          </div>
        </BorderGlow>
      </div>

      {/* Recent leads */}
      <BorderGlow
        borderRadius={16}
        glowRadius={30}
        glowIntensity={0.8}
        glowColor="218 100 65"
        colors={['#ff4b2b', '#b083ff', '#4c8dff']}
        animated
        fillOpacity={0.35}
      >
        <div>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
            <div>
              <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Leads recentes</h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Últimos {recent.length} cadastrados</p>
            </div>
            <button onClick={() => onView('leads')}
              className="flex items-center gap-1.5 text-xs rounded-lg cursor-pointer transition-colors"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border-line)', background: 'var(--bg-elevated)', padding: '6px 12px' }}>
              Ver todos
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center py-16" style={{ color: 'var(--text-muted)' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2.5 opacity-35"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
              <p className="text-sm">Nenhum lead cadastrado ainda</p>
              <button onClick={onNewLead} className="mt-3 flex items-center gap-1.5 text-xs text-[#ff4b2b] hover:underline cursor-pointer">
                Cadastrar primeiro lead
              </button>
            </div>
          ) : (
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr>
                  {['Cliente', 'Origem', 'Status', 'Data', 'Modelo'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] uppercase tracking-widest font-bold"
                      style={{ background: 'var(--bg-panel-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-line-soft)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((l) => {
                  const sc = STATUS_COLORS[l.status]
                  const oc = ORIGEM_COLORS[l.origem]
                  return (
                    <tr key={l.id} className="transition-colors last:border-0"
                      style={{ borderBottom: '1px solid var(--border-line-soft)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-panel-2)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <td className="px-4 py-3">
                        <b className="block font-semibold" style={{ color: 'var(--text-primary)' }}>{l.nome}</b>
                        {l.telefone && <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{l.telefone}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-semibold" style={{ background: oc.bg, color: oc.text }}>{l.origem}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-semibold" style={{ background: sc.bg, color: sc.text }}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-dim)' }}>{fmtDate(l.data)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-dim)' }}>{l.modelo || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </BorderGlow>
    </div>
  )
}

function StatCard({ label, value, color, sub, glowHSL, colors }: {
  label: string; value: number; color: string; sub?: string
  glowHSL: string; colors: string[]
}) {
  return (
    <BorderGlow
      borderRadius={16}
      glowRadius={25}
      glowIntensity={0.9}
      glowColor={glowHSL}
      colors={colors}
      animated
      fillOpacity={0.4}
    >
      <div className="px-5 py-4 flex flex-col gap-1.5 transition-shadow hover:shadow-lg">
        <p className="text-[11.5px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 32, fontWeight: 700, lineHeight: 1, color }}>{value}</p>
        {sub && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </BorderGlow>
  )
}