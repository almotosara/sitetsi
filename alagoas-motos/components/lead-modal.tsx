'use client'

import { useEffect, useState } from 'react'
import type { Lead, LeadOrigem, LeadStatus } from '@/lib/types'
import { todayISO, STATUS_OPTIONS } from '@/lib/constants'

interface LeadModalProps {
  open: boolean
  editing: Lead | null
  onClose: () => void
  onSave: (data: Omit<Lead, 'id' | 'user_id' | 'criado_em' | 'atualizado_em'>) => Promise<void>
}

const EMPTY: Omit<Lead, 'id' | 'user_id' | 'criado_em' | 'atualizado_em'> = {
  nome: '', telefone: '', origem: 'Bot WhatsApp', data: '', os: '', nf: '',
  modelo: '', cpf: '', email: '', status: 'Novo', obs: '',
}

export function LeadModal({ open, editing, onClose, onSave }: LeadModalProps) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          nome: editing.nome, telefone: editing.telefone ?? '', origem: editing.origem,
          data: editing.data ?? '', os: editing.os ?? '', nf: editing.nf ?? '',
          modelo: editing.modelo ?? '', cpf: editing.cpf ?? '', email: editing.email ?? '',
          status: editing.status, obs: editing.obs ?? '',
        })
      } else {
        setForm({ ...EMPTY, data: todayISO() })
      }
    }
  }, [open, editing])

  if (!open) return null

  function set(k: keyof typeof EMPTY, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      await onSave({ ...form, nome: form.nome.trim() })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(3px)', padding: '5vh 16px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl modal-anim"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)', boxShadow: '0 10px 30px -12px var(--shadow-heavy)' }}
      >
        {/* Head */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
          <h3 style={{ fontFamily: 'var(--font-rajdhani), Rajdhani, sans-serif', fontSize: 19, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            {editing ? 'Editar lead' : 'Novo lead'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
            style={{ border: '1px solid var(--border-line)', background: 'var(--bg-elevated)', color: 'var(--text-dim)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-3.5">
          {/* Origem */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>Origem do lead *</label>
            <div className="flex gap-2">
              {(['Bot WhatsApp', 'Website'] as LeadOrigem[]).map((o) => {
                const sel = form.origem === o
                return (
                  <button
                    key={o}
                    onClick={() => set('origem', o)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-[10px] border py-3 font-semibold text-[13.5px] cursor-pointer transition-all"
                    style={{
                      borderColor: sel ? (o === 'Bot WhatsApp' ? '#b083ff' : '#4c8dff') : 'var(--border-line)',
                      background: sel ? (o === 'Bot WhatsApp' ? '#b083ff26' : '#4c8dff26') : 'var(--bg-input)',
                      color: sel ? (o === 'Bot WhatsApp' ? '#b083ff' : '#4c8dff') : 'var(--text-dim)',
                    }}
                  >
                    {o === 'Bot WhatsApp' ? <IconWa /> : <IconWeb />}
                    {o}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Nome */}
          <Field label="Nome do cliente *">
            <input value={form.nome} onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex: Rafaela da Silva Santos" className="inp" />
          </Field>

          {/* Telefone + Data */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <input value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)}
                placeholder="(82) 9....-..." className="inp" type="tel" />
            </Field>
            <Field label="Data do lead">
              <input value={form.data ?? ''} onChange={(e) => set('data', e.target.value)} className="inp" type="date" />
            </Field>
          </div>

          {/* OS + NF */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº O.S.">
              <input value={form.os ?? ''} onChange={(e) => set('os', e.target.value)}
                placeholder="Ex: 93222" className="inp mono" />
            </Field>
            <Field label="Nº NF">
              <input value={form.nf ?? ''} onChange={(e) => set('nf', e.target.value)}
                placeholder="Opcional" className="inp mono" />
            </Field>
          </div>

          {/* Modelo + CPF */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modelo da moto">
              <input value={form.modelo ?? ''} onChange={(e) => set('modelo', e.target.value)}
                placeholder="Ex: Honda CG 160 Titan" className="inp" />
            </Field>
            <Field label="CPF / CNPJ">
              <input value={form.cpf ?? ''} onChange={(e) => set('cpf', e.target.value)}
                placeholder="000.000.000-00" className="inp mono" />
            </Field>
          </div>

          {/* Email */}
          <Field label="E-mail">
            <input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)}
              placeholder="cliente@email.com" className="inp" />
          </Field>

          {/* Status */}
          <Field label="Status">
            <select value={form.status} onChange={(e) => set('status', e.target.value as LeadStatus)} className="inp">
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>

          {/* Obs */}
          <Field label="Observações">
            <textarea value={form.obs ?? ''} onChange={(e) => set('obs', e.target.value)}
              placeholder="Interesse em modelo, condição de pagamento, etc."
              className="inp" style={{ resize: 'vertical', minHeight: 64 }} />
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex justify-end gap-2.5" style={{ borderTop: '1px solid var(--border-line-soft)' }}>
          <button onClick={onClose} className="btn-ghost-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.nome.trim()} className="btn-primary-sm">
            {saving ? 'Salvando…' : 'Salvar lead'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .inp {
          background: var(--bg-input); border: 1px solid var(--border-line); color: var(--text-primary);
          padding: 10px 12px; border-radius: 9px; font-size: 14px; outline: none; width: 100%;
          transition: border-color 0.12s, box-shadow 0.12s; font-family: inherit;
        }
        .inp:focus { border-color: #ff4b2b; box-shadow: 0 0 0 3px #ff4b2b33; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .btn-ghost-sm {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 14px; border-radius: 9px; border: 1px solid var(--border-line);
          background: transparent; color: var(--text-primary); font-size: 13.5px; font-weight: 600;
          cursor: pointer; transition: 0.12s; font-family: inherit;
        }
        .btn-ghost-sm:hover { background: var(--bg-elevated); }
        .btn-primary-sm {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 14px; border-radius: 9px; border: 1px solid #ff4b2b;
          background: linear-gradient(135deg, #ff4b2b, #d63a1e); color: #fff;
          font-size: 13.5px; font-weight: 600; cursor: pointer; transition: 0.12s;
          box-shadow: 0 6px 16px -6px #ff4b2b70; font-family: inherit;
        }
        .btn-primary-sm:hover:not(:disabled) { filter: brightness(1.08); }
        .btn-primary-sm:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

function IconWa() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.7.8 1.8.1.2.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.4-.4.5-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.5 1.5.3.1.5.1.7-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.8.8.3.1.5.2.5.3.1.2.1.6-.1 1.1Z"/></svg>
}
function IconWeb() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/></svg>
}