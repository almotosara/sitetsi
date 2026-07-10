'use client'

import { useState } from 'react'
import type { ClienteFiel } from '@/lib/types'

interface FieisViewProps {
  fieis: ClienteFiel[]
  onAdd: (nome: string, whatsapp: string | null) => Promise<void>
  onEdit: (id: string, nome: string, whatsapp: string | null) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const INP: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)',
  padding: '10px 12px', borderRadius: 9, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'inherit',
}
const GHOST_BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9,
  border: '1px solid var(--border-line)', background: 'transparent', color: 'var(--text-primary)',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const PRIMARY_BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9,
  border: '1px solid #ff4b2b', background: 'linear-gradient(135deg, #ff4b2b, #d63a1e)', color: '#fff',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 6px 16px -6px #ff4b2b70',
}

export function FieisView({ fieis, onAdd, onEdit, onDelete }: FieisViewProps) {
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<{ open: boolean; id: string | null; nome: string; wa: string }>({
    open: false, id: null, nome: '', wa: '',
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = fieis.filter((f) => {
    const text = q.toLowerCase()
    return !text || f.nome.toLowerCase().includes(text) || f.whatsapp?.includes(text)
  })

  function openAdd() { setModal({ open: true, id: null, nome: '', wa: '' }) }
  function openEdit(f: ClienteFiel) { setModal({ open: true, id: f.id, nome: f.nome, wa: f.whatsapp || '' }) }
  function closeModal() { setModal({ open: false, id: null, nome: '', wa: '' }) }

  async function handleSave() {
    if (!modal.nome.trim()) return
    setSaving(true)
    try {
      if (modal.id) {
        await onEdit(modal.id, modal.nome.trim(), modal.wa || null)
      } else {
        await onAdd(modal.nome.trim(), modal.wa || null)
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  function waLink(wa: string | null) {
    if (!wa) return null
    const num = wa.replace(/\D/g, '')
    return `https://wa.me/55${num}`
  }

  return (
    <div className="view-enter flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Clientes Fiéis</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{fieis.length} clientes cadastrados</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-[9px] text-white font-semibold text-[13.5px] cursor-pointer hover:brightness-110 transition-all"
          style={{ background: 'linear-gradient(135deg, #ff4b2b, #d63a1e)', border: '1px solid #ff4b2b', boxShadow: '0 6px 16px -6px #ff4b2b70' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Adicionar cliente
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou WhatsApp…"
          className="pl-9 w-full" style={INP} />
      </div>

      {/* List */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16" style={{ color: 'var(--text-muted)' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2.5 opacity-30"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            <p className="text-sm">{fieis.length === 0 ? 'Nenhum cliente fiel cadastrado' : 'Nenhum resultado encontrado'}</p>
          </div>
        ) : (
          filtered.map((f, i) => (
            <div key={f.id} className={`flex items-center gap-4 px-5 py-4 transition-colors ${i < filtered.length - 1 ? '' : ''}`}
              style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-line-soft)' : 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-panel-2)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-none"
                style={{ background: '#ff4b2b26', color: '#ff4b2b' }}>
                {f.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{f.nome}</div>
                {f.whatsapp && (
                  <a href={waLink(f.whatsapp) || '#'} target="_blank" rel="noopener noreferrer"
                    className="text-[12.5px] flex items-center gap-1 hover:underline mt-0.5" style={{ color: '#2fd675' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Z"/></svg>
                    {f.whatsapp}
                  </a>
                )}
              </div>
              <div className="flex gap-1.5 flex-none">
                <IconBtn title="Editar" onClick={() => openEdit(f)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </IconBtn>
                {confirmDelete === f.id ? (
                  <>
                    <IconBtn title="Confirmar exclusão" danger onClick={async () => { await onDelete(f.id); setConfirmDelete(null) }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    </IconBtn>
                    <IconBtn title="Cancelar" onClick={() => setConfirmDelete(null)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </IconBtn>
                  </>
                ) : (
                  <IconBtn title="Excluir" onClick={() => setConfirmDelete(f.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </IconBtn>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(3px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="w-full max-w-[420px] mx-4 rounded-2xl modal-anim" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
              <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 19, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {modal.id ? 'Editar cliente' : 'Adicionar cliente fiel'}
              </h3>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                style={{ border: '1px solid var(--border-line)', background: 'var(--bg-elevated)', color: 'var(--text-dim)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>Nome *</label>
                <input value={modal.nome} onChange={(e) => setModal((m) => ({ ...m, nome: e.target.value }))}
                  placeholder="Ex: João da Silva" style={{ ...INP, display: 'block' }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>WhatsApp</label>
                <input value={modal.wa} onChange={(e) => setModal((m) => ({ ...m, wa: e.target.value }))}
                  placeholder="(82) 9 9999-9999" style={{ ...INP, display: 'block' }} type="tel" />
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2.5" style={{ borderTop: '1px solid var(--border-line-soft)' }}>
              <button onClick={closeModal} style={GHOST_BTN}>Cancelar</button>
              <button onClick={handleSave} disabled={saving || !modal.nome.trim()} style={PRIMARY_BTN}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
      style={{
        border: '1px solid var(--border-line)',
        background: danger ? '#ff5a5f26' : 'var(--bg-elevated)',
        color: danger ? '#ff5a5f' : 'var(--text-dim)',
      }}>
      {children}
    </button>
  )
}