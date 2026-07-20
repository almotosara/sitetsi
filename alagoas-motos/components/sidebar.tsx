'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { useTheme } from './theme-provider'
import { SettingsModal } from './settings-modal'

type View = 'dash' | 'leads' | 'report' | 'tsi' | 'tsilist' | 'tsiresend' | 'fieis'

interface SidebarProps {
  view: View
  onView: (v: View) => void
  userName: string
  userEmail: string
  avatarUrl?: string
  onSignOut: () => void
  goal: number
  onGoalChange: (g: number) => void
  onProfileChange: (name: string, avatar: string) => void
}

interface NavItemDef {
  id: View
  label: string
  icon: React.ReactNode
  children?: { id: View; label: string; icon: React.ReactNode }[]
}

const NAV_ITEMS: NavItemDef[] = [
  {
    id: 'dash',
    label: 'Painel',
    icon: <IconDash />,
  },
  {
    id: 'leads',
    label: 'Leads',
    icon: <IconLeads />,
    children: [
      { id: 'report', label: 'Relatórios', icon: <IconChart /> },
    ],
  },
  {
    id: 'tsi',
    label: 'TSI — Top2Box',
    icon: <IconTsi />,
    children: [
      { id: 'tsi', label: 'Metas', icon: <IconTarget /> },
      { id: 'tsilist', label: 'Pesquisas', icon: <IconCheck /> },
      { id: 'tsiresend', label: 'Reenvio de Pesquisas', icon: <IconResend /> },
      { id: 'fieis', label: 'Clientes Fiéis', icon: <IconHeart /> },
    ],
  },
]

export function Sidebar({ view, onView, userName, userEmail, avatarUrl, onSignOut, goal, onGoalChange, onProfileChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'perfil' | 'meta' | 'aparencia' | 'sobre'>('perfil')
  const { theme, toggle } = useTheme()

  // Estado de abertura dos grupos
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    if (view === 'leads' || view === 'report') init['leads'] = true
    if (['tsi', 'tsilist', 'tsiresend', 'fieis'].includes(view)) init['tsi'] = true
    return init
  })

  const w = collapsed ? 58 : 230
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([])
  const circleRefs = useRef<(HTMLSpanElement | null)[]>([])
  const tlRefs = useRef<gsap.core.Timeline[]>([])
  const activeTweenRefs = useRef<gsap.core.Tween[]>([])
  const sidebarRef = useRef<HTMLElement>(null)

  // Layout dos pills (GSAP) — calcula o círculo de hover
  const layoutPills = useCallback(() => {
    pillRefs.current.forEach((pill, i) => {
      const circle = circleRefs.current[i]
      if (!pill || !circle) return

      const rect = pill.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const R = ((w * w) / 4 + h * h) / (2 * h)
      const D = Math.ceil(2 * R) + 2
      const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1

      circle.style.width = `${D}px`
      circle.style.height = `${D}px`
      circle.style.left = `-${delta}px`

      gsap.set(circle, {
        yPercent: -50,
        scale: 0,
        transformOrigin: `${delta}px 50%`,
      })

      // Timeline de hover
      tlRefs.current[i]?.kill()
      const tl = gsap.timeline({ paused: true })
      tl.to(circle, { scale: 1.1, yPercent: -50, duration: 0.5, ease: 'power2.out', overwrite: 'auto' }, 0)
      tlRefs.current[i] = tl
    })
  }, [])

  useEffect(() => {
    layoutPills()
    const onResize = () => layoutPills()
    window.addEventListener('resize', onResize)
    if (document.fonts?.ready) {
      document.fonts.ready.then(layoutPills).catch(() => {})
    }
    return () => window.removeEventListener('resize', onResize)
  }, [layoutPills, collapsed])

  const handlePillEnter = (i: number) => {
    const tl = tlRefs.current[i]
    if (!tl) return
    activeTweenRefs.current[i]?.kill()
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.25,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  const handlePillLeave = (i: number) => {
    const tl = tlRefs.current[i]
    if (!tl) return
    activeTweenRefs.current[i]?.kill()
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.2,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const isActive = (id: View) => view === id
  const isGroupActive = (group: NavItemDef) =>
    group.id === view || group.children?.some((c) => c.id === view)

  return (
    <aside
      ref={sidebarRef}
      className="flex-none flex flex-col sticky top-0 h-screen overflow-hidden transition-all duration-200"
      style={{
        width: w,
        minWidth: w,
        background: 'var(--sidebar-bg)',
        padding: collapsed ? '18px 10px' : '18px 12px',
        borderRight: '1px solid var(--border-line-soft)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center pb-5"
        style={{
          justifyContent: collapsed ? 'flex-start' : 'center',
          padding: collapsed ? '0 0 0 2px' : '0 8px',
          transition: 'all 0.2s ease',
        }}
      >
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/alagoas-motos-removebg-preview-iffjRi9U1BJ8xt500mZrqPuJrzBzos.png"
          alt="Alagoas Motos"
          width={collapsed ? 32 : 148}
          height={collapsed ? 32 : 44}
          className="object-contain"
          style={{ transition: 'all 0.2s ease' }}
          unoptimized
        />
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg border-0 bg-transparent text-xs font-semibold cursor-pointer transition-colors mb-2"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s', flexShrink: 0 }}
        >
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        {!collapsed && <span>Recolher</span>}
      </button>

      {/* ─── PillNav Navigation ─────────────────────────────────── */}
      <nav className="flex flex-col gap-1 mt-1.5 flex-1">
        {NAV_ITEMS.map((group, gi) => {
          const groupActive = isGroupActive(group)
          return (
            <div key={group.id}>
              <button
                ref={(el) => { pillRefs.current[gi] = el }}
                className={`pill-nav-item ${groupActive ? 'is-active' : ''}`}
                onClick={() => {
                  if (!collapsed && group.children) toggleGroup(group.id)
                  onView(group.id)
                }}
                onMouseEnter={() => handlePillEnter(gi)}
                onMouseLeave={() => handlePillLeave(gi)}
                title={collapsed ? group.label : undefined}
                style={{ justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10 }}
              >
                {/* GSAP hover circle */}
                <span
                  ref={(el) => { circleRefs.current[gi] = el }}
                  className="hover-circle"
                  aria-hidden="true"
                />
                <span className="pill-icon" style={{ color: groupActive ? 'var(--pill-nav-pill)' : 'inherit' }}>
                  {group.icon}
                </span>
                {!collapsed && (
                  <span className="label-stack">
                    <span className="pill-label">{group.label}</span>
                  </span>
                )}
                {!collapsed && group.children && (
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{
                      opacity: 0.55,
                      transform: openGroups[group.id] ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.22s',
                      marginLeft: 'auto',
                      flexShrink: 0,
                    }}
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                )}
              </button>

              {/* Sub-items */}
              {!collapsed && group.children && openGroups[group.id] && (
                <div className="flex flex-col gap-0.5 pt-0.5">
                  {group.children.map((child) => (
                    <button
                      key={child.id}
                      className={`pill-nav-sub ${isActive(child.id) ? 'is-active' : ''}`}
                      onClick={() => onView(child.id)}
                    >
                      {child.icon}
                      <span>{child.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ─── GERAL ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 pt-3 mt-1 border-t" style={{ borderColor: 'var(--border-line-soft)' }}>
        {!collapsed && (
          <span className="px-2.5 pb-1 text-[10.5px] font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
            GERAL
          </span>
        )}
        <button
          className="pill-nav-item"
          onClick={() => { setSettingsTab('perfil'); setSettingsOpen(true) }}
          title={collapsed ? 'Configurações' : undefined}
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10 }}
        >
          <span className="pill-icon"><IconSettings /></span>
          {!collapsed && <span className="label-stack"><span className="pill-label">Configurações</span></span>}
        </button>
        <button
          className="pill-nav-item"
          onClick={() => { setSettingsTab('meta'); setSettingsOpen(true) }}
          title={collapsed ? 'Metas' : undefined}
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10 }}
        >
          <span className="pill-icon"><IconTarget /></span>
          {!collapsed && <span className="label-stack"><span className="pill-label">Metas</span></span>}
        </button>
        <button
          className="pill-nav-item"
          onClick={onSignOut}
          title={collapsed ? 'Sair' : undefined}
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10 }}
        >
          <span className="pill-icon"><IconLogout /></span>
          {!collapsed && <span className="label-stack"><span className="pill-label">Sair</span></span>}
        </button>
      </div>
      {/* ─── Footer: Theme ──────────────────────────────────────── */}
      <div className="flex flex-col gap-2 pt-3 mt-1 border-t" style={{ borderColor: 'var(--border-line-soft)' }}>
        <button
          className="theme-toggle"
          onClick={toggle}
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10 }}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? <IconMoon /> : <IconSun />}
          {!collapsed && (
            <>
              <span>{theme === 'dark' ? 'Modo escuro' : 'Modo claro'}</span>
              <div className="theme-switch">
                <div className="theme-switch-knob">
                  {theme === 'dark' ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                  )}
                </div>
              </div>
            </>
          )}
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userName={userName}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
        goal={goal}
        onGoalChange={onGoalChange}
        onProfileChange={onProfileChange}
        onSignOut={onSignOut}
        initialTab={settingsTab}
      />
    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════ */

function IconDash() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M12 3a9 9 0 0 0-9 9c0 2.3.8 4.4 2.2 6h13.6a9 9 0 0 0 2.2-6 9 9 0 0 0-9-9Z"/><path d="M12 12 16 8"/></svg>
}
function IconLeads() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
}
function IconChart() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l3-4 3 2 4-6"/></svg>
}
function IconTsi() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
}
function IconTarget() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>
}
function IconCheck() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
}
function IconResend() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
}
function IconHeart() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
}
function IconSettings() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
}
function IconLogout() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
function IconMoon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
}
function IconSun() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
}