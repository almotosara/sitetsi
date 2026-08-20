'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTheme } from './theme-provider'

type View = 'revisao' | 'agendamentos' | 'valores' | 'maodeobra' | 'tmo' | 'manuais'

interface OficinaSidebarProps {
  view: View
  onView: (v: View) => void
  userName: string
  userEmail: string
  avatarUrl?: string
  onSignOut: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

interface NavItemDef {
  id: View
  label: string
  grupo: 'Oficina' | 'Ferramentas'
  icon: React.ReactNode
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'revisao', label: 'Consulta de Revisão', grupo: 'Oficina', icon: <IconWrench /> },
  { id: 'agendamentos', label: 'Agendamentos', grupo: 'Oficina', icon: <IconCalendar /> },
  { id: 'valores', label: 'Consulta de Valores', grupo: 'Oficina', icon: <IconTag /> },
  { id: 'maodeobra', label: 'Tabela de Mão de Obra', grupo: 'Oficina', icon: <IconClock /> },
  { id: 'tmo', label: 'Calculadora de TMO', grupo: 'Ferramentas', icon: <IconCalculator /> },
  { id: 'manuais', label: 'Manuais Honda', grupo: 'Ferramentas', icon: <IconBook /> },
]

const ACCENT = '#d71920'

export function OficinaSidebar({ view, onView, userName, userEmail, avatarUrl, onSignOut, mobileOpen = false, onMobileClose }: OficinaSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const sidebarRef = useRef<HTMLElement>(null)

  const w = collapsed ? 68 : 258

  useEffect(() => {
    if (mobileOpen) setCollapsed(false)
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onMobileClose?.() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handler)
    }
  }, [mobileOpen, onMobileClose])

  const selectView = (nextView: View) => {
    onView(nextView)
    onMobileClose?.()
  }

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!accountOpen) return
    const handler = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [accountOpen])

  // Escape fecha o menu
  useEffect(() => {
    if (!accountOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAccountOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [accountOpen])

  let grupoAtual = ''

  return (
    <>
    <button
      type="button"
      className={`sidebar-overlay ${mobileOpen ? 'is-visible' : ''}`}
      onClick={onMobileClose}
      aria-label="Fechar menu da oficina"
      tabIndex={mobileOpen ? 0 : -1}
    />
    <div
      aria-hidden="true"
      className="oficina-sidebar-spacer flex-none transition-all duration-200"
      style={{ width: w, minWidth: w }}
    />
    <aside
      ref={sidebarRef}
      className={`am-sidebar responsive-sidebar flex-none flex flex-col fixed left-0 top-0 h-screen overflow-hidden ${mobileOpen ? 'is-mobile-open' : ''}`}
      style={{
        width: w,
        minWidth: w,
        background: 'var(--sidebar-bg)',
        padding: collapsed ? '18px 10px' : '18px 14px',
        borderRight: '1px solid var(--border-line-soft)',
        transition: 'width .28s cubic-bezier(.22,1,.36,1), min-width .28s cubic-bezier(.22,1,.36,1), padding .28s',
      }}
    >
      <style>{`
        .am-nav-item{position:relative;display:flex;align-items:center;width:100%;border:none;background:transparent;
          border-radius:13px;padding:9px 11px;cursor:pointer;color:var(--text-muted);font-size:12.8px;font-weight:600;
          text-align:left;transition:background .18s ease,color .18s ease,transform .18s cubic-bezier(.22,1,.36,1)}
        .am-nav-item:hover{background:var(--sidebar-hover);color:var(--text-primary);transform:translateX(2px)}
        .am-nav-item .am-ico{display:flex;flex:none;align-items:center;justify-content:center;transition:color .18s,transform .25s cubic-bezier(.22,1,.36,1)}
        .am-nav-item:hover .am-ico{transform:scale(1.08)}
        .am-nav-item.is-active{background:${ACCENT};color:#fff;box-shadow:0 14px 26px -18px rgba(215,25,32,.95)}
        .am-nav-item.is-active .am-ico{color:#fff}
        .am-nav-item .am-label{white-space:nowrap;overflow:hidden}
        .am-nav-item .am-mark{position:absolute;left:-14px;top:50%;width:3px;height:0;border-radius:0 3px 3px 0;
          background:${ACCENT};transform:translateY(-50%);transition:height .25s cubic-bezier(.22,1,.36,1)}
        .am-nav-item.is-active .am-mark{height:56%}
        .am-tip{position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%) scale(.96);
          background:var(--card-bg);color:var(--text-primary);border:1px solid var(--border-line-soft);
          border-radius:9px;padding:5px 10px;font-size:11.5px;font-weight:600;white-space:nowrap;pointer-events:none;
          opacity:0;transition:opacity .15s,transform .15s;z-index:50;box-shadow:0 12px 26px -18px rgba(0,0,0,.6)}
        .am-nav-item:hover .am-tip{opacity:1;transform:translateY(-50%) scale(1)}
        .am-group{font-size:9.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--text-muted);
          padding:12px 12px 5px;opacity:.75}
      `}</style>

      {/* Logo */}
      <div
        className="sidebar-brand flex items-center pb-4"
        style={{
          justifyContent: 'center',
          padding: collapsed ? '0 0 8px' : '0 8px 8px',
          transition: 'all .25s ease',
        }}
      >
        <Image
          src={collapsed ? '/alagoas-motos-symbol.webp' : '/alagoas-motos-logo.webp'}
          alt="Alagoas Motos"
          width={collapsed ? 38 : 188}
          height={collapsed ? 38 : 75}
          className="object-contain"
          style={{ width: collapsed ? 38 : 188, height: collapsed ? 38 : 75, transition: 'all .25s ease' }}
          unoptimized
        />
      </div>

      <button type="button" className="sidebar-mobile-close" onClick={onMobileClose} aria-label="Fechar menu da oficina">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        Fechar menu
      </button>

      {/* Collapse */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="sidebar-collapse-button flex items-center gap-2 w-full rounded-xl border-0 bg-transparent text-[11.5px] font-semibold cursor-pointer"
        style={{ color: 'var(--text-muted)', padding: '7px 11px', transition: 'background .18s' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .28s cubic-bezier(.22,1,.36,1)', flexShrink: 0 }}
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {!collapsed && <span>Recolher</span>}
      </button>

      {/* Navegação */}
      <nav className="sidebar-nav flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-visible mt-1">
        {NAV_ITEMS.map((item) => {
          const active = view === item.id
          const novoGrupo = item.grupo !== grupoAtual
          grupoAtual = item.grupo
          return (
            <div key={item.id}>
              {novoGrupo && !collapsed && <div className="am-group">{item.grupo}</div>}
              {novoGrupo && collapsed && (
                <div className="mx-2 my-2 h-px" style={{ background: 'var(--border-line-soft)' }} />
              )}
              <button
                className={`am-nav-item ${active ? 'is-active' : ''}`}
                onClick={() => selectView(item.id)}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                style={{ justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10 }}
              >
                <span className="am-mark" aria-hidden="true" />
                <span className="am-ico">{item.icon}</span>
                {!collapsed && <span className="am-label">{item.label}</span>}
                {collapsed && <span className="am-tip">{item.label}</span>}
              </button>
            </div>
          )
        })}
      </nav>

      {/* Footer: tema + conta */}
      <div className="sidebar-footer flex flex-none flex-col gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-line-soft)' }}>
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
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="5" />
                    </svg>
                  )}
                </div>
              </div>
            </>
          )}
        </button>

        <div className="account-wrap relative">
          <button
            className="account-trigger"
            onClick={() => (collapsed ? onSignOut() : setAccountOpen(!accountOpen))}
            title={collapsed ? 'Sair da conta' : userName}
            style={{
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '10px' : '8px 10px',
              width: '100%',
              margin: 0,
            }}
          >
            <div
              className="account-avatar"
              style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            >
              {!avatarUrl && userName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
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
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </>
            )}
          </button>

          {accountOpen && !collapsed && (
            <>
              <div className="account-overlay" onClick={() => setAccountOpen(false)} />
              <div className="account-menu-popup modal-anim">
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
                      <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                  )}
                  {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                </button>
                <div className="menu-divider" />
                <button className="menu-item danger" onClick={onSignOut}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sair da conta
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
    </>
  )
}

/* ═══════════════════ ICONS ═══════════════════ */

function IconWrench() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
}
function IconTag() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41L13.42 20.58a2 2 0 01-2.83 0L2.5 12.5V4h8.5l9.59 9.59a2 2 0 010 2.82z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
}
function IconClock() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
}
function IconCalendar() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
}
function IconCalculator() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="8" y2="10" /><line x1="12" y1="10" x2="12" y2="10" /><line x1="16" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="18" /><line x1="8" y1="18" x2="12" y2="18" /></svg>
}
function IconBook() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
}
function IconMoon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
}
function IconSun() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
}
