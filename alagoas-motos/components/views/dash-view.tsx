'use client'

import { useMemo, useState, useEffect } from 'react'
import type { Lead } from '@/lib/types'
import { STATUS_COLORS, STATUS_OPTIONS, fmtDate } from '@/lib/constants'

interface DashViewProps {
  leads: Lead[]
  goal: number
  onGoalChange: (g: number) => void
  onView: (v: string) => void
  onNewLead: () => void
}

// ── Ícones inline ───────────────────────────────────────────────────
const IconArrow = ({ className = '' }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 17L17 7M8 7h9v9" />
  </svg>
)
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
)
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
)
const IconPlay = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
)
const IconPause = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
)
const IconStop = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
)

// ── Card auxiliar ───────────────────────────────────────────────────
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`} style={{ background: 'var(--card-bg)', borderColor: 'var(--border-line-soft)' }}>
      {children}
    </div>
  )
}

// ── Stat card branco ────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <Panel className="p-5 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-dim)' }}>{label}</span>
        <button className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:opacity-70" style={{ border: '1px solid var(--border-line)', color: 'var(--text-dim)' }}>
          <IconArrow />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-4xl font-bold leading-none" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{value}</span>
        <span className="text-[11.5px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <span className="w-4 h-4 rounded-sm inline-flex items-center justify-center" style={{ background: '#0f7a5a1a', color: '#0f7a5a' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </span>
          {sub}
        </span>
      </div>
    </Panel>
  )
}

// ── Stat card destacado (verde escuro) ──────────────────────────────
function StatCardHighlight({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-6" style={{ background: '#0f7a5a', color: '#ffffff' }}>
      <div className="flex items-start justify-between">
        <span className="text-sm font-semibold opacity-90">{label}</span>
        <button className="w-7 h-7 rounded-full flex items-center justify-center transition-colors" style={{ background: '#ffffff', color: '#0f7a5a' }}>
          <IconArrow />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-4xl font-bold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{value}</span>
        <span className="text-[11.5px] flex items-center gap-1.5 opacity-90">
          <span className="w-4 h-4 rounded-sm inline-flex items-center justify-center" style={{ background: '#ffffff33' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </span>
          {sub}
        </span>
      </div>
    </div>
  )
}

// ── Time tracker ─────────────────────────────────────────────────────
function TimeTracker() {
  const [seconds, setSeconds] = useState(5048) // 01:24:08
  const [running, setRunning] = useState(true)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')

  return (
    <div className="rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden" style={{ background: '#141618', color: '#ffffff', minHeight: 180 }}>
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, #0f7a5a 0%, transparent 55%), radial-gradient(circle at 80% 90%, #22c55e33 0%, transparent 60%)',
        }}
        aria-hidden
      />
      <div className="relative flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
        <span className="text-sm font-semibold">Time Tracker</span>
      </div>
      <div className="relative">
        <div className="text-5xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{h}:{m}:{s}</div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => setRunning((r) => !r)} className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105" style={{ background: '#ffffff', color: '#141618' }} aria-label={running ? 'Pausar' : 'Iniciar'}>
            {running ? <IconPause /> : <IconPlay />}
          </button>
          <button onClick={() => { setRunning(false); setSeconds(0) }} className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105" style={{ background: '#d0524d', color: '#ffffff' }} aria-label="Parar">
            <IconStop />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Project Analytics (barras) ──────────────────────────────────────
// Mostra quantos leads foram CONVERTIDOS em cada um dos últimos 7 dias.
// Como não existe uma data de conversão dedicada, usamos "atualizado_em"
// (data da última atualização do lead) como referência de quando ele
// passou pro status "Convertido" — é a melhor aproximação disponível.
function ProjectAnalytics({ leads }: { leads: Lead[] }) {
  const days = useMemo(() => {
    const arr: { label: string; count: number; isToday: boolean }[] = []
    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
    const now = new Date()
    const convertidos = leads.filter((l) => l.status === 'Convertido')
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const count = convertidos.filter((l) => (l.atualizado_em || '').slice(0, 10) === key).length
      arr.push({ label: labels[d.getDay()], count, isToday: i === 0 })
    }
    return arr
  }, [leads])
  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((s, d) => s + d.count, 0)
  const highlight = days.reduce((a, b) => (b.count > a.count ? b : a), days[0])

  return (
    <Panel className="p-5 flex flex-col gap-5" >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Leads convertidos</h3>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-dim)' }}>
          {total > 0 ? `${total} nos últimos 7 dias` : 'Últimos 7 dias'}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3 h-40 relative">
        {days.map((d, i) => {
          const h = 12 + (d.count / max) * 120
          const isMax = d === highlight && d.count > 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 relative">
              {isMax && (
                <span className="absolute -top-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#0f7a5a', color: '#fff' }}>{Math.round((d.count / (max || 1)) * 100)}%</span>
              )}
              <div
                className="w-full rounded-full transition-all"
                style={{
                  height: h,
                  maxWidth: 42,
                  background: isMax
                    ? 'linear-gradient(180deg, #22c55e 0%, #0f7a5a 100%)'
                    : 'repeating-linear-gradient(135deg, #eef0ea 0 6px, transparent 6px 10px), #f2f3ef',
                }}
              />
              <span className="text-xs font-semibold" style={{ color: d.isToday ? 'var(--text-primary)' : 'var(--text-muted)' }}>{d.label}</span>
            </div>
          )
        })}
      </div>
      {total === 0 && (
        <p className="text-xs text-center -mt-2" style={{ color: 'var(--text-muted)' }}>Nenhum lead convertido nos últimos 7 dias.</p>
      )}
    </Panel>
  )
}

// ── Reminders ───────────────────────────────────────────────────────
interface ReminderItem { id: string; text: string; done: boolean }
const REMINDERS_KEY = 'am_reminders'

function Reminders() {
  const [items, setItems] = useState<ReminderItem[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMINDERS_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(REMINDERS_KEY, JSON.stringify(items)) } catch {}
  }, [items, loaded])

  function addReminder() {
    const text = draft.trim()
    if (!text) { setAdding(false); return }
    setItems((prev) => [{ id: `${Date.now()}`, text, done: false }, ...prev])
    setDraft('')
    setAdding(false)
  }

  function toggle(id: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)))
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const pending = items.filter((i) => !i.done).length

  return (
    <Panel className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Lembretes</span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{pending > 0 ? `${pending} pendente${pending > 1 ? 's' : ''}` : 'Tudo em dia'}</span>
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105"
          style={{ background: '#0f7a5a', color: '#ffffff' }}
          title="Adicionar lembrete"
        >
          <IconPlus />
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addReminder(); if (e.key === 'Escape') { setAdding(false); setDraft('') } }}
            placeholder="Novo lembrete…"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)' }}
          />
          <button onClick={addReminder} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#0f7a5a', color: '#fff' }}>
            Adicionar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 220 }}>
        {items.length === 0 && !adding && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum lembrete. Clique em + para adicionar.</p>
        )}
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-2.5 py-1.5 px-1 rounded-lg transition-colors hover:bg-[var(--sidebar-hover)]">
            <button
              onClick={() => toggle(it.id)}
              className="w-[18px] h-[18px] rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ border: it.done ? 'none' : '1.5px solid var(--border-line)', background: it.done ? '#0f7a5a' : 'transparent' }}
              aria-label={it.done ? 'Marcar como pendente' : 'Marcar como concluído'}
            >
              {it.done && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              )}
            </button>
            <span
              className="flex-1 text-[13px] truncate"
              style={{ color: it.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: it.done ? 'line-through' : 'none' }}
            >
              {it.text}
            </span>
            <button
              onClick={() => remove(it.id)}
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Remover lembrete"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── Project list ────────────────────────────────────────────────────
function ProjectsList({ leads, onView }: { leads: Lead[]; onView: (v: string) => void }) {
  const recent = leads.slice(0, 5)
  const colors = ['#0f7a5a', '#4f7ac7', '#d9a441', '#8a6bc4', '#d0524d']
  return (
    <Panel className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Leads recentes</h3>
        <button onClick={() => onView('leads')} className="text-xs px-2.5 py-1 rounded-full font-semibold transition-colors hover:opacity-80" style={{ border: '1px solid var(--border-line)', color: 'var(--text-dim)' }}>
          Ver todos
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {recent.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum lead cadastrado.</p>
        )}
        {recent.map((l, i) => (
          <div key={l.id} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: `${colors[i % colors.length]}1a`, color: colors[i % colors.length] }}>
              {(l.nome || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{l.nome || 'Sem nome'}</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{l.modelo || l.origem} · {fmtDate(l.data)}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── Leads por status ─────────────────────────────────────────────────
// Substitui o antigo card de "colaboração da equipe" (nomes fictícios que
// não vinham de lugar nenhum) por um resumo real: quantos leads existem
// em cada status hoje, com barra de proporção e link direto pra lista
// filtrada.
function StatusBreakdown({ leads, onView }: { leads: Lead[]; onView: (v: string) => void }) {
  const total = leads.length
  const rows = STATUS_OPTIONS.map((status) => ({
    status,
    count: leads.filter((l) => l.status === status).length,
  }))

  return (
    <Panel className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Leads por status</h3>
        <button onClick={() => onView('leads')} className="text-xs px-2.5 py-1 rounded-full font-semibold transition-colors hover:opacity-80" style={{ border: '1px solid var(--border-line)', color: 'var(--text-dim)' }}>
          Ver todos
        </button>
      </div>
      <div className="flex flex-col gap-3.5">
        {total === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum lead cadastrado ainda.</p>
        )}
        {total > 0 && rows.map((r) => {
          const sc = STATUS_COLORS[r.status] || { bg: '#eef0ea', text: '#4a4f55' }
          const pct = total > 0 ? (r.count / total) * 100 : 0
          return (
            <button
              key={r.status}
              onClick={() => onView('leads')}
              className="flex flex-col gap-1.5 text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>{r.status}</span>
                <span className="text-[12.5px] font-bold" style={{ color: sc.text }}>{r.count}</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div
                  className="h-full rounded-full transition-all group-hover:opacity-80"
                  style={{ width: `${pct}%`, background: sc.text, minWidth: r.count > 0 ? 6 : 0 }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

// ── Progress gauge ──────────────────────────────────────────────────
function ProgressGauge({ pct, goal, done, onGoalChange }: { pct: number; goal: number; done: number; onGoalChange: (g: number) => void }) {
  const R = 82
  const CIRC = Math.PI * R
  const filled = (pct / 100) * CIRC
  return (
    <Panel className="p-5 flex flex-col gap-3">
      <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Progresso da meta</h3>
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <svg width="220" height="130" viewBox="0 0 220 130">
          <path d="M 20 115 A 90 90 0 0 1 200 115" fill="none" stroke="#eef0ea" strokeWidth="18" strokeLinecap="round" />
          <defs>
            <linearGradient id="gauge" x1="0" x2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#0f7a5a" />
            </linearGradient>
            <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="8" fill="#eef0ea" />
            </pattern>
          </defs>
          <path d="M 20 115 A 90 90 0 0 1 200 115" fill="none" stroke="url(#hatch)" strokeWidth="18" strokeLinecap="round" opacity="0.6" />
          <path d="M 20 115 A 90 90 0 0 1 200 115" fill="none" stroke="url(#gauge)" strokeWidth="18" strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRC}`}
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{Math.round(pct)}%</div>
          <div className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>convertidos</div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-line-soft)' }}>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#0f7a5a' }} />Convertidos {done}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#eef0ea' }} />Restante {Math.max(0, goal - done)}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Meta:
          <input type="number" value={goal} min={1}
            onChange={(e) => onGoalChange(Number(e.target.value))}
            className="w-14 px-2 py-1 rounded-md text-center text-xs font-bold outline-none"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>
    </Panel>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard principal
// ═══════════════════════════════════════════════════════════════════
export function DashView({ leads, goal, onGoalChange, onView, onNewLead }: DashViewProps) {
  const now = new Date()
  const monthLeads = useMemo(() => leads.filter((l) => {
    if (!l.data) return false
    const d = new Date(l.data + 'T12:00:00')
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }), [leads])

  const total = monthLeads.length
  const byStatus = useMemo(() => {
    const m: Record<string, number> = {}
    monthLeads.forEach((l) => { m[l.status] = (m[l.status] || 0) + 1 })
    return m
  }, [monthLeads])

  const convertidos = byStatus['Convertido'] || 0
  const perdidos = byStatus['Perdido'] || 0
  const emAndamento = (byStatus['Em contato'] || 0) + (byStatus['Proposta enviada'] || 0)
  const novos = byStatus['Novo'] || 0
  const pct = goal > 0 ? Math.min(100, (convertidos / goal) * 100) : 0

  return (
    <div className="view-enter flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Painel</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Planeje, priorize e acompanhe seus leads com facilidade.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onNewLead} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02]" style={{ background: '#0f7a5a', color: '#ffffff' }}>
            <IconPlus /> Novo lead
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors hover:bg-[var(--sidebar-hover)]" style={{ border: '1px solid var(--border-line)', color: 'var(--text-primary)' }}>
            <IconDownload /> Importar
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCardHighlight label="Total do mês" value={total} sub="Cadastros no mês atual" />
        <StatCard label="Convertidos" value={convertidos} sub={`${perdidos} perdidos`} />
        <StatCard label="Em andamento" value={emAndamento} sub="Contato + proposta" />
        <StatCard label="Novos" value={novos} sub="Aguardando 1º contato" />
      </div>

      {/* Middle row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
        <ProjectAnalytics leads={leads} />
        <Reminders />
        <ProjectsList leads={leads} onView={onView} />
      </div>

      {/* Bottom row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
        <StatusBreakdown leads={leads} onView={onView} />
        <ProgressGauge pct={pct} goal={goal} done={convertidos} onGoalChange={onGoalChange} />
        <TimeTracker />
      </div>
    </div>
  )
}
