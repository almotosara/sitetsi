'use client'

import { useState, useTransition, useRef, useCallback, useMemo } from 'react'
import type { Lead, TsiRow, ClienteFiel, LeadOrigem, LeadStatus } from '@/lib/types'
import { TSI_STORE_MAP } from '@/lib/constants'
import { Sidebar } from './sidebar'
import { LeadModal } from './lead-modal'
import { DashView } from './views/dash-view'
import { LeadsView } from './views/leads-view'
import { ReportView } from './views/report-view'
import { TsiView } from './views/tsi-view'
import { TsiListView } from './views/tsi-list-view'
import { FieisView } from './views/fieis-view'
import { useToast } from './toast'
import {
  createLead, updateLead, deleteLead,
  replaceTsiData, upsertSettings, updateProfile,
  createClienteFiel, updateClienteFiel, deleteClienteFiel,
  bulkCreateLeads,
} from '@/app/actions'

type View = 'dash' | 'leads' | 'report' | 'tsi' | 'tsilist' | 'fieis'

const VIEW_TITLES: Record<View, { title: string; sub: string }> = {
  dash:    { title: 'Painel de Leads', sub: 'Visão geral do mês' },
  leads:   { title: 'Leads', sub: 'Todos os registros' },
  report:  { title: 'Relatórios', sub: 'Análise por período' },
  tsi:     { title: 'TSI — Top2Box', sub: 'Metas e indicadores' },
  tsilist: { title: 'Pesquisas TSI', sub: 'Lista detalhada' },
  fieis:   { title: 'Clientes Fiéis', sub: 'Clientes recorrentes' },
}

// ID fixo do usuário (single-user)
const USER_ID = '00000000-0000-0000-0000-000000000001'

// ─── Utility: getCol — busca flexível de coluna (igual ao HTML de referência) ───
function getCol(row: Record<string, unknown>, ...candidates: string[]): string {
  for (const c of candidates) {
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().trim() === c.toLowerCase().trim() ||
          k.toLowerCase().includes(c.toLowerCase())) return String(row[k] ?? '').trim()
    }
  }
  return ''
}

// ─── Utility: numOrZero — parseFloat que trata vazio/NaN como 0 (não existe "nulo" nessas pesquisas) ───
function numOrZero(v: string): number {
  const n = parseFloat(v)
  return Number.isNaN(n) ? 0 : n
}

// ─── Utility: titleCase (igual ao HTML de referência) ───
function titleCase(s: string): string {
  return s.toLowerCase().split(' ').map(w => w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w).join(' ')
}

// ─── Utility: tsiFmtDate — formata data para DD/MM/YYYY (igual ao HTML) ───
function tsiFmtDate(val: unknown): string {
  if (val === undefined || val === null || val === '') return ''
  if (typeof val === 'number' && !isNaN(val)) {
    const dt = new Date(Math.round((val - 25569) * 86400 * 1000))
    return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
  }
  const s = String(val).trim().split(' ')[0].split('T')[0]
  if (s.includes('-')) { const p = s.split('-'); if (p[0]?.length === 4) return `${p[2]}/${p[1]}/${p[0]}` }
  else if (s.includes('/')) {
    const p = s.split('/')
    if (p[0]?.length === 4) return `${p[2]}/${p[1]}/${p[0]}`
    if (p.length === 3) return `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`
  }
  return s
}

// ─── TSI meta row patterns (copyright, salesforce footer) ───
const TSI_SKIP_PATTERNS = [/confidenciais/i, /copyright/i, /salesforce/i, /direitos reservados/i, /todos os direitos/i]
function tsiRowIsMeta(row: Record<string, unknown>): boolean {
  const text = Object.values(row).map(v => String(v ?? '')).join(' ')
  return TSI_SKIP_PATTERNS.some(p => p.test(text))
}

interface AppShellProps {
  userName: string
  userEmail: string
  initialLeads: Lead[]
  initialTsi: TsiRow[]
  initialFieis: ClienteFiel[]
  initialGoal: number
  initialTsiUpdatedAt: string | null
  initialDisplayName?: string | null
  initialAvatarUrl?: string | null
}

export function AppShell({
  userName, userEmail, initialLeads, initialTsi, initialFieis, initialGoal, initialTsiUpdatedAt,
  initialDisplayName, initialAvatarUrl,
}: AppShellProps) {
  const [view, setView] = useState<View>('dash')
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [tsiData, setTsiData] = useState<TsiRow[]>(initialTsi)
  const [fieis, setFieis] = useState<ClienteFiel[]>(initialFieis)
  const [goal, setGoalState] = useState(initialGoal)
  const [tsiUpdatedAt, setTsiUpdatedAt] = useState(initialTsiUpdatedAt)
  const [displayName, setDisplayName] = useState(initialDisplayName || '')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || '')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [, startTrans] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mwFileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const nowMeta = VIEW_TITLES[view]
  const TODAY_LABEL = useMemo(() => {
    const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }, [])
  const sub = nowMeta.sub === 'Visão geral do mês' ? TODAY_LABEL : nowMeta.sub

  const effectiveName = (displayName || userName || '').trim()
  const firstName = effectiveName.split(' ')[0]
  const greeting = useMemo(() => {
    const h = new Date().getHours()
    const saudacao = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'
    return firstName ? `${saudacao}, ${firstName}!` : `${saudacao}!`
  }, [firstName])
  const title = view === 'dash' ? greeting : nowMeta.title

  // ─── Lead handlers ───────────────────────────────────────────────────────────

  const handleSaveLead = useCallback(async (data: Omit<Lead, 'id' | 'user_id' | 'criado_em' | 'atualizado_em'>) => {
    if (editing) {
      setLeads((prev) => prev.map((l) => l.id === editing.id ? { ...l, ...data } : l))
      try {
        await updateLead(editing.id, data)
        toast('Lead atualizado com sucesso.')
      } catch (e) {
        setLeads(initialLeads)
        toast('Erro ao atualizar lead.', true)
      }
    } else {
      const temp: Lead = {
        id: `temp-${Date.now()}`,
        user_id: USER_ID,
        ...data,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      }
      setLeads((prev) => [temp, ...prev])
      try {
        await createLead(data)
        toast('Lead cadastrado com sucesso.')
        startTrans(() => {})
      } catch (e: unknown) {
        setLeads((prev) => prev.filter((l) => l.id !== temp.id))
        const msg = e instanceof Error ? e.message : 'Erro desconhecido'
        toast(`Erro ao cadastrar lead: ${msg}`, true)
      }
    }
  }, [editing, initialLeads, toast])

  const handleDeleteLead = useCallback(async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id))
    try {
      await deleteLead(id)
      toast('Lead excluído.')
    } catch {
      toast('Erro ao excluir lead.', true)
    }
  }, [toast])

  const handleConvertLead = useCallback(async (id: string) => {
    const lead = leads.find(l => l.id === id)
    if (!lead || lead.status === 'Convertido') return
    const updated = { ...lead, status: 'Convertido' as LeadStatus }
    setLeads((prev) => prev.map(l => l.id === id ? updated : l))
    try {
      await updateLead(id, { status: 'Convertido' })
      toast('Lead convertido com sucesso.')
    } catch {
      setLeads((prev) => prev.map(l => l.id === id ? lead : l))
      toast('Erro ao converter lead.', true)
    }
  }, [leads, toast])

  // ─── Goal handler ─────────────────────────────────────────────────────────────

  const handleGoalChange = useCallback(async (g: number) => {
    setGoalState(g)
    try { await upsertSettings(g, tsiUpdatedAt) } catch {}
  }, [tsiUpdatedAt])

  // ─── Profile handler (nome + foto) ─────────────────────────────────────────

  const handleProfileChange = useCallback(async (name: string, avatar: string) => {
    setDisplayName(name)
    setAvatarUrl(avatar)
    try {
      await updateProfile(name || null, avatar || null)
      toast('Perfil atualizado com sucesso.')
    } catch {
      toast('Erro ao salvar perfil.', true)
    }
  }, [toast])

  // ─── TSI import (CORRIGIDO — colunas reais da planilha Salesforce) ────────────

  const handleTsiImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

      if (!json.length) { toast('O arquivo não possui dados legíveis.', true); return }

      // Filtra linhas de copyright/rodapé do Salesforce
      const filtered = json.filter(row => !tsiRowIsMeta(row))
      const skipped = json.length - filtered.length

      // Normaliza igual ao HTML de referência (tsiNormalizeRow)
      const mapped = filtered.map(r => {
        const osKey = getCol(r, 'Ordens de Serviço: OS', 'OS')
        if (!osKey) return null
        const rawLoja = getCol(r, 'Nome da conta') || 'Desconhecido'
        const rawDate = getCol(r, 'Data conclusão final', 'Data da resposta', 'Data conclusão', 'Data de conclusão', 'Data', 'Data da Avaliação')
        return {
          os: osKey,
          loja: (TSI_STORE_MAP as Record<string, string>)[rawLoja] || rawLoja,
          t2b: numOrZero(getCol(r, 'Nota Top2Box')),
          tsi: numOrZero(getCol(r, 'Nota Pesquisa TSI')),
          cilindrada: getCol(r, 'Categoria Produto') || 'Não Informado',
          tipo: getCol(r, 'Tipo conclusão final'),
          comentario: getCol(r, 'Comentário conclusão final'),
          data: tsiFmtDate(rawDate),
        }
      }).filter(Boolean) as Omit<TsiRow, 'id' | 'user_id' | 'importado_em'>[]

      const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      await replaceTsiData(mapped)
      await upsertSettings(goal, now)
      setTsiData(mapped.map((r, i) => ({ ...r, id: `t${i}`, user_id: USER_ID, importado_em: new Date().toISOString() })))
      setTsiUpdatedAt(now)
      toast(`${mapped.length} pesquisas TSI importadas.${skipped ? ` (${skipped} linhas de rodapé ignoradas)` : ''}`)
    } catch (err) {
      console.error('[TSI] import error:', err)
      toast('Erro ao importar planilha TSI.', true)
    }
  }, [goal, toast])

  // ─── Clientes Fiéis ──────────────────────────────────────────────────────────

  const handleAddFiel = useCallback(async (nome: string, wa: string | null) => {
    const temp: ClienteFiel = { id: `tf-${Date.now()}`, user_id: USER_ID, nome, whatsapp: wa, criado_em: new Date().toISOString() }
    setFieis((prev) => [temp, ...prev])
    try {
      await createClienteFiel(nome, wa)
      toast('Cliente adicionado.')
    } catch {
      setFieis((prev) => prev.filter((f) => f.id !== temp.id))
      toast('Erro ao adicionar cliente.', true)
    }
  }, [toast])

  const handleEditFiel = useCallback(async (id: string, nome: string, wa: string | null) => {
    setFieis((prev) => prev.map((f) => f.id === id ? { ...f, nome, whatsapp: wa } : f))
    try {
      await updateClienteFiel(id, nome, wa)
      toast('Cliente atualizado.')
    } catch {
      toast('Erro ao atualizar cliente.', true)
    }
  }, [toast])

  const handleDeleteFiel = useCallback(async (id: string) => {
    setFieis((prev) => prev.filter((f) => f.id !== id))
    try {
      await deleteClienteFiel(id)
      toast('Cliente removido.')
    } catch {
      toast('Erro ao remover cliente.', true)
    }
  }, [toast])

  // ─── MicroWork Import (CORRIGIDO — igual ao HTML de referência) ──────────────

  const handleMicroWorkImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

      console.log('[MicroWork] Colunas:', rows[0] ? Object.keys(rows[0]) : [])
      console.log('[MicroWork] Total de linhas:', rows.length)

      let added = 0, updated = 0, skipped = 0
      const toCreate: Omit<Lead, 'id' | 'user_id' | 'criado_em' | 'atualizado_em'>[] = []
      const toUpdate: { id: string; data: Partial<Lead> }[] = []

      for (const row of rows) {
        // Colunas exatas do MicroWork CLOUD DMS
        const osRaw = getCol(row, 'Nº O.S.', 'N° O.S.', 'N. O.S.', 'No O.S.', 'OS', 'O.S.')
        const nome = titleCase(getCol(row, 'Pessoa', 'Cliente', 'Nome', 'Razão Social'))

        // Pula linhas sem OS e sem nome (cabecalhos de empresa como "Empresa: ARA")
        if (!osRaw && !nome) continue
        if (!nome || nome.length < 2) continue

        const osNum = osRaw.replace(/\s/g, '')
        const modelo = getCol(row, 'Modelo', 'Veículo', 'Veiculo', 'Moto')
        const cpf = getCol(row, 'CPF/CNPJ Pessoa', 'CPF/CNPJ', 'CPF', 'CNPJ', 'Doc')
        const email = getCol(row, 'E-mail Pessoa', 'E-mail', 'Email', 'Mail')
        const telefone = getCol(row, 'Telefone Celular', 'Celular', 'Telefone', 'Fone', 'Tel')
        const situacao = getCol(row, 'Situação', 'Situacao', 'Status')
        const status: LeadStatus = 'Novo'

        // Deduplicação por OS
        const existing = osNum
          ? leads.find(x => x.os && String(x.os).replace(/\s/g, '') === osNum)
          : null

        if (existing) {
          const changed = (
            (nome && existing.nome !== nome) ||
            (telefone && existing.telefone !== telefone) ||
            (email && existing.email !== email) ||
            (cpf && existing.cpf !== cpf) ||
            (modelo && existing.modelo !== modelo)
          )
          if (changed) {
            toUpdate.push({
              id: existing.id,
              data: {
                ...(nome && existing.nome !== nome ? { nome } : {}),
                ...(telefone && existing.telefone !== telefone ? { telefone } : {}),
                ...(email && existing.email !== email ? { email } : {}),
                ...(cpf && existing.cpf !== cpf ? { cpf } : {}),
                ...(modelo && existing.modelo !== modelo ? { modelo } : {}),
              },
            })
            updated++
          } else {
            skipped++
          }
        } else {
          toCreate.push({
            nome: nome || 'Sem nome',
            telefone: telefone || null,
            origem: 'MicroWork OS' as LeadOrigem,
            os: osNum || null,
            nf: null,
            modelo: modelo || null,
            cpf: cpf || null,
            email: email || null,
            data: new Date().toISOString().slice(0, 10),
            status,
            obs: situacao ? `Situação no MicroWork: ${situacao}` : 'Importado do MicroWork CLOUD DMS',
          })
          added++
        }
      }

      if (!added && !updated && !skipped) {
        toast('Nenhum dado encontrado na planilha. Verifique se o arquivo exportado é a listagem de O.S. do MicroWork.', true)
        return
      }

      // Persiste no Supabase
      let persistError: string | null = null
      let inserted: Lead[] = []
      if (toCreate.length > 0) {
        try { inserted = await bulkCreateLeads(toCreate) }
        catch (e) { persistError = e instanceof Error ? e.message : 'Erro ao salvar no Supabase' }
      }
      for (const u of toUpdate) {
        try { await updateLead(u.id, u.data) }
        catch (e) { persistError = persistError || (e instanceof Error ? e.message : 'Erro ao salvar no Supabase') }
      }
      if (persistError) {
        toast(`Falha ao salvar na nuvem: ${persistError}. Nada foi importado — corrija e tente de novo.`, true)
        return
      }

      // Atualiza estado local (usa os IDs reais retornados pelo Supabase)
      const now = new Date().toISOString()
      if (inserted.length > 0) {
        setLeads(prev => [...inserted, ...prev])
      }
      if (toUpdate.length > 0) {
        setLeads(prev => prev.map(l => {
          const u = toUpdate.find(x => x.id === l.id)
          return u ? { ...l, ...u.data, atualizado_em: now } : l
        }))
      }

      const parts: string[] = []
      if (added) parts.push(`${added} leads importados`)
      if (updated) parts.push(`${updated} atualizados`)
      if (skipped) parts.push(`${skipped} sem alteração`)
      toast(parts.join(' · '))
    } catch (err) {
      console.error('[MicroWork] import error:', err)
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast(`Erro ao importar: ${msg}`, true)
    }
  }, [leads, toast])

  // ─── Sign out ────────────────────────────────────────────────────────────────

  const handleSignOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }, [])

  return (
    <div className="flex min-h-screen">
      <Sidebar
        view={view}
        onView={(v) => setView(v as View)}
        userName={effectiveName || userName}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
        onSignOut={handleSignOut}
        goal={goal}
        onGoalChange={handleGoalChange}
        onProfileChange={handleProfileChange}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <div
          className="sticky top-0 z-20 flex items-center gap-3.5 px-6 py-4"
          style={{
            background: 'var(--topbar-bg)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--border-line-soft)',
          }}
        >
          <div className="flex-1">
            <h1
              className="transition-colors duration-300"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: 21,
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary)',
                letterSpacing: 0.3,
              }}
            >
              {title}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </div>

          {(view === 'tsi' || view === 'tsilist') && (
            <button onClick={handleTsiImport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] border text-white font-semibold text-[13.5px] cursor-pointer hover:brightness-110 transition-all"
              style={{
                background: 'linear-gradient(135deg, #ff4b2b, #d63a1e)',
                borderColor: '#ff4b2b',
                boxShadow: '0 6px 16px -6px #ff4b2b70',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>
              Anexar planilha TSI
            </button>
          )}

          {(view === 'dash' || view === 'leads') && (
            <>
              <button onClick={() => mwFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] border font-semibold text-[13.5px] cursor-pointer hover:brightness-110 transition-all"
                style={{
                  background: 'var(--bg-panel-2)',
                  borderColor: 'var(--border-line)',
                  color: 'var(--text-dim)',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3v18M3 9h18M3 15h18"/></svg>
                Importar XLSX do MicroWork
              </button>
              <button onClick={() => { setEditing(null); setModalOpen(true) }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] border text-white font-semibold text-[13.5px] cursor-pointer hover:brightness-110 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #ff4b2b, #d63a1e)',
                  borderColor: '#ff4b2b',
                  boxShadow: '0 6px 16px -6px #ff4b2b70',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Novo lead
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 pb-16 max-w-[1320px] w-full mx-auto">
          {view === 'dash' && (
            <DashView leads={leads} goal={goal} onGoalChange={handleGoalChange}
              onView={(v) => setView(v as View)}
              onNewLead={() => { setEditing(null); setModalOpen(true) }} />
          )}
          {view === 'leads' && (
            <LeadsView leads={leads} fieis={fieis}
              onEdit={(l) => { setEditing(l); setModalOpen(true) }}
              onDelete={handleDeleteLead}
              onConvert={handleConvertLead}
              onNew={() => { setEditing(null); setModalOpen(true) }} />
          )}
          {view === 'report' && <ReportView leads={leads} />}
          {view === 'tsi' && <TsiView tsiData={tsiData} tsiUpdatedAt={tsiUpdatedAt} onImport={handleTsiImport} />}
          {view === 'tsilist' && <TsiListView tsiData={tsiData} onImport={handleTsiImport} />}
          {view === 'fieis' && (
            <FieisView fieis={fieis} onAdd={handleAddFiel} onEdit={handleEditFiel} onDelete={handleDeleteFiel} />
          )}
        </div>
      </div>

      {/* Lead Modal */}
      <LeadModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={handleSaveLead}
      />

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
      <input ref={mwFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleMicroWorkImport} />
    </div>
  )
}