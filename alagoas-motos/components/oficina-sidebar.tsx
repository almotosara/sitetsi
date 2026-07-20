'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { useTheme } from './theme-provider'

type View = 'revisao' | 'valores' | 'maodeobra' | 'manuais'

interface OficinaSidebarProps {
  view: View
  onView: (v: View) => void
  userName: string
  userEmail: string
  avatarUrl?: string
  onSignOut: () => void
}

interface NavItemDef {
  id: View
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'revisao', label: 'Consulta de Revisão', icon: <IconWrench /> },
  { id: 'valores', label: 'Consulta de Valores', icon: <IconTag /> },
  { id: 'maodeobra', label: 'Tabela de Mão de Obra', icon: <IconClock /> },
  { id: 'manuais', label: 'Manuais Honda', icon: <IconBook /> },
]

export function OficinaSidebar({ view, onView, userName, userEmail, avatarUrl, onSignOut }: OficinaSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [avatarHover, setAvatarHover] = useState(false)
  const { theme, toggle } = useTheme()
  const avatarExpanded = !collapsed && (avatarHover || accountOpen)

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

  const isActive = (id: View) => view === id

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!accountOpen) return
    const handler = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [accountOpen])

  // Tecla Escape fecha menu
  useEffect(() => {
    if (!accountOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [accountOpen])

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
        {NAV_ITEMS.map((item, gi) => {
          const active = isActive(item.id)
          return (
            <button
              key={item.id}
              ref={(el) => { pillRefs.current[gi] = el }}
              className={`pill-nav-item ${active ? 'is-active' : ''}`}
              onClick={() => onView(item.id)}
              onMouseEnter={() => handlePillEnter(gi)}
              onMouseLeave={() => handlePillLeave(gi)}
              title={collapsed ? item.label : undefined}
              style={{ justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10 }}
            >
              {/* GSAP hover circle */}
              <span
                ref={(el) => { circleRefs.current[gi] = el }}
                className="hover-circle"
                aria-hidden="true"
              />
              <span className="pill-icon" style={{ color: active ? 'var(--pill-nav-pill)' : 'inherit' }}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className="label-stack">
                  <span className="pill-label">{item.label}</span>
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ─── Footer: Theme + Account ───────────────────────────── */}
      <div className="flex flex-col gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-line-soft)' }}>
        {/* Theme Toggle */}
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

        {/* Account Menu */}
        <div
          className="relative"
          onMouseEnter={() => setAvatarHover(true)}
          onMouseLeave={() => setAvatarHover(false)}
        >
          <button
            className="account-trigger"
            onClick={() => setAccountOpen(!accountOpen)}
            style={{
              justifyContent: collapsed || !avatarExpanded ? 'center' : 'flex-start',
              gap: collapsed || !avatarExpanded ? 0 : 10,
              padding: collapsed ? '10px' : avatarExpanded ? '10px 12px' : '7px',
              width: collapsed ? '100%' : avatarExpanded ? '100%' : 'fit-content',
              margin: collapsed || avatarExpanded ? 0 : '0 auto',
            }}
          >
            <div className="account-avatar" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
              {!avatarUrl && userName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && avatarExpanded && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{userName}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{userEmail}</div>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{
                    color: 'var(--text-muted)',
                    transform: accountOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </>
            )}
          </button>

          {/* Popup Menu */}
          {accountOpen && !collapsed && (
            <>
              <div className="account-overlay" onClick={() => setAccountOpen(false)} />
              <div className="account-menu-popup modal-anim">
                {/* User info header */}
                <div className="flex items-center gap-3 px-3 py-3">
                  <div
                    className="account-avatar"
                    style={{
                      width: 38, height: 38, fontSize: 16,
                      ...(avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
                    }}
                  >
                    {!avatarUrl && userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{userName}</div>
                    <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{userEmail}</div>
                  </div>
                </div>
                <div className="menu-divider" />
                <button className="menu-item" onClick={() => { setAccountOpen(false); toggle() }}>
                  {theme === 'dark' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                  )}
                  {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                </button>
                <div className="menu-divider" />
                <button className="menu-item danger" onClick={onSignOut}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sair da conta
                </button>
              </div>
            </>
          )}
        </div>
      </div>

    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════ */

function IconWrench() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
}
function IconTag() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41L13.42 20.58a2 2 0 01-2.83 0L2.5 12.5V4h8.5l9.59 9.59a2 2 0 010 2.82z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>
}
function IconClock() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
}
function IconBook() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
}
function IconMoon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
}
function IconSun() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
}