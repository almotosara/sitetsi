'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import type { ReenvioRow, ClienteFiel } from '@/lib/types'

type ImportRow = Omit<ReenvioRow, 'id' | 'user_id' | 'importado_em' | 'contatado' | 'contatado_em' | 'contatado_canal'>

interface TsiReenvioViewProps {
  fieis: ClienteFiel[]
  rows: ReenvioRow[]
  onImport: (rows: ImportRow[]) => void | Promise<void>
  onContatado: (id: string, canal: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
}

const INP: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)',
  padding: '9px 12px', borderRadius: 9, fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
}

// ─── normaliza nome para comparação (remove acentos, espaços extras, caixa) ───
function normName(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getCol(row: Record<string, unknown>, ...candidates: string[]): string {
  for (const c of candidates) {
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().trim() === c.toLowerCase().trim() ||
          k.toLowerCase().includes(c.toLowerCase())) return String(row[k] ?? '').trim()
    }
  }
  return ''
}

function fmtDateVal(val: string): string {
  if (!val) return ''
  return val.split(' ')[0]
}

// ─── remove o código da concessionária do número da O.S. (ex: "1234567-001" → "1234567") ───
function cleanOs(os: string): string {
  if (!os) return os
  return os.split(/[-/]/)[0].trim()
}

// ─── primeiro nome do cliente, para personalizar a mensagem ───
function firstName(cliente: string): string {
  return cliente.trim().split(' ')[0] || cliente
}

function waTemplateLink(celular: string | null, cliente: string) {
  if (!celular) return null
  const num = celular.replace(/\D/g, '')
  if (!num) return null
  const withCountry = num.startsWith('55') ? num : `55${num}`
  const msg = `Bom dia ou boa tarde! ${firstName(cliente)}, enviei uma pesquisa de satisfação em seu SMS sobre seu serviço aqui na Honda Alagoas Motos, você finaliza em menos de 5 minutos! Se puder preenchê-la com nota 10, ajuda muito nossa equipe continuar melhorando cada vez mais!`
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`
}

export function TsiReenvioView({ fieis, rows, onImport, onContatado, onDelete }: TsiReenvioViewProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [onlyFieis, setOnlyFieis] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fieisNames = useMemo(() => new Set(fieis.map((f) => normName(f.nome))), [fieis])

  const handleImport = useCallback(() => fileInputRef.current?.click(), [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setLoading(true)
    setError(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      let json: Record<string, unknown>[] = []

      // Suporta .xls que na verdade é HTML exportado (ex: Salesforce), além de xlsx/csv reais
      const isHtml = (() => {
        const head = new TextDecoder('iso-8859-1').decode(new Uint8Array(buf).slice(0, 512)).toLowerCase()
        return head.includes('<html') || head.includes('<table')
      })()

      if (isHtml) {
        const text = new TextDecoder('iso-8859-1').decode(new Uint8Array(buf))
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'text/html')
        const table = doc.querySelector('table')
        if (!table) throw new Error('Nenhuma tabela encontrada no arquivo.')
        const wsFromHtml = XLSX.utils.table_to_sheet(table)
        json = XLSX.utils.sheet_to_json(wsFromHtml, { defval: '' })
      } else {
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        json = XLSX.utils.sheet_to_json(ws, { defval: '' })
      }

      if (!json.length) { setError('O arquivo não possui dados legíveis.'); setLoading(false); return }

      const mapped: ImportRow[] = json.map((r) => {
        const os = getCol(r, 'Ordens de Serviço: OS', 'Ordens de Servico: OS', 'OS')
        const cliente = getCol(r, 'Cliente')
        const email = getCol(r, 'E-mail do Cliente', 'Email do Cliente')
        const celular = getCol(r, 'Celular do Cliente')
        const veiculo = getCol(r, 'Veículo', 'Veiculo')
        const dataEnvioEmail = getCol(r, 'Data de envio pesquisa por email')
        const dataEnvioSms = getCol(r, 'Data de envio pesquisa por SMS')
        const dataReenvio = getCol(r, 'Data de reenvio do TSI')
        const loja = getCol(r, 'Nome da conta')
        if (!os && !cliente) return null
        return {
          os,
          cliente,
          email: email || null,
          celular: celular || null,
          veiculo: veiculo || null,
          dataEnvioEmail: fmtDateVal(dataEnvioEmail) || null,
          dataEnvioSms: fmtDateVal(dataEnvioSms) || null,
          dataReenvio: fmtDateVal(dataReenvio) || null,
          loja: loja || null,
          isFiel: cliente ? fieisNames.has(normName(cliente)) : false,
        }
      }).filter(Boolean) as ImportRow[]

      if (!mapped.length) { setError('Não foi possível reconhecer as colunas esperadas na planilha.'); setLoading(false); return }

      await onImport(mapped)
      setFileName(file.name)
      setSelected(new Set())
    } catch (err) {
      console.error('[Reenvio] import error:', err)
      setError(err instanceof Error ? err.message : 'Erro ao importar planilha.')
    } finally {
      setLoading(false)
    }
  }, [fieisNames, onImport])

  const filtered = useMemo(() => rows.filter((r) => {
    if (onlyFieis && !r.isFiel) return false
    const text = q.toLowerCase()
    if (text && !r.cliente.toLowerCase().includes(text) && !r.os.toLowerCase().includes(text) && !(r.email || '').toLowerCase().includes(text)) return false
    return true
  }).sort((a, b) => (b.isFiel ? 1 : 0) - (a.isFiel ? 1 : 0)), [rows, q, onlyFieis])

  const fieisCount = useMemo(() => rows.filter((r) => r.isFiel).length, [rows])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const allSelected = filtered.every((r) => prev.has(r.id))
      const next = new Set(prev)
      if (allSelected) {
        filtered.forEach((r) => next.delete(r.id))
      } else {
        filtered.forEach((r) => next.add(r.id))
      }
      return next
    })
  }

  function exportSelected() {
    const toExport = filtered.filter((r) => selected.size === 0 ? true : selected.has(r.id))
    if (!toExport.length) return
    import('xlsx').then((XLSX) => {
      const data = toExport.map((r) => ({
        'Ordens de Serviço: OS': r.os,
        'Cliente': r.cliente,
        'E-mail do Cliente': r.email || '',
        'Celular do Cliente': r.celular || '',
        'Veículo': r.veiculo || '',
        'Cliente Fiel': r.isFiel ? 'Sim' : 'Não',
        'Nome da conta': r.loja || '',
      }))
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Reenvio')
      XLSX.writeFile(wb, 'reenvio-pesquisas-tsi.xlsx')
    })
  }

  return (
    <div className="view-enter flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="flex items-center gap-2" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4b2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
            Reenvio de Pesquisas
          </h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {rows.length === 0 ? 'Anexe a planilha de clientes para reenviar a pesquisa TSI.' : `${filtered.length} de ${rows.length} registros ${fileName ? `· ${fileName}` : ''}`}
          </p>
        </div>
        <button onClick={handleImport} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[9px] text-white font-semibold text-[13.5px] cursor-pointer hover:brightness-110 transition-all disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #ff4b2b, #d63a1e)', border: '1px solid #ff4b2b', boxShadow: '0 6px 16px -6px #ff4b2b70' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>
          {loading ? 'Processando…' : 'Anexar planilha de reenvio'}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#ff5a5f1a', border: '1px solid #ff5a5f55', color: '#ff5a5f' }}>
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl p-12 text-center cursor-pointer transition-colors" style={{ border: '2px dashed var(--border-line)', color: 'var(--text-muted)' }}
          onClick={handleImport}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ff4b2b'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-line)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-50"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>
          <p className="font-semibold mb-1">Nenhuma planilha carregada</p>
          <p className="text-sm">Clique aqui para anexar a planilha de clientes (ex: exportada do Salesforce) e identificar os clientes fiéis para reenvio.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <KpiCard label="Total na planilha" value={String(rows.length)} />
            <KpiCard label="Clientes Fiéis" value={String(fieisCount)} color="#2fd675" />
            <KpiCard label="Selecionados" value={String(selected.size)} />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, OS, e-mail…" className="pl-9 w-full" style={INP} />
            </div>
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-[9px] cursor-pointer select-none text-[13px] font-semibold"
              style={{ border: '1px solid var(--border-line)', color: onlyFieis ? '#2fd675' : 'var(--text-dim)', background: onlyFieis ? '#2fd67514' : 'transparent' }}>
              <input type="checkbox" checked={onlyFieis} onChange={(e) => setOnlyFieis(e.target.checked)} className="accent-[#2fd675]" />
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              Somente clientes fiéis
            </label>
            <button onClick={exportSelected} disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] border font-semibold text-[13px] cursor-pointer hover:brightness-110 transition-all disabled:opacity-50"
              style={{ background: 'var(--bg-panel-2)', borderColor: 'var(--border-line)', color: 'var(--text-dim)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15V3M6 9l6 6 6-6"/><path d="M21 21H3"/></svg>
              Exportar {selected.size > 0 ? `selecionados (${selected.size})` : 'lista filtrada'}
            </button>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-16" style={{ color: 'var(--text-muted)' }}>
                <p className="text-sm">Nenhum resultado encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className="px-3.5 py-2.5" style={{ background: 'var(--bg-panel-2)', borderBottom: '1px solid var(--border-line-soft)', width: 36 }}>
                        <input type="checkbox" checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))} onChange={toggleSelectAllVisible} />
                      </th>
                      {['Cliente', 'O.S.', 'Fiel?', 'E-mail', 'Celular', 'Veículo', 'Envio e-mail', 'Envio SMS', 'Ação'].map((h) => (
                        <th key={h} className="text-left px-3.5 py-2.5 text-[10.5px] uppercase tracking-widest font-bold whitespace-nowrap"
                          style={{ background: 'var(--bg-panel-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-line-soft)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const wa = waTemplateLink(r.celular, r.cliente)
                      return (
                        <tr key={r.id} className="transition-colors last:border-0" style={{ borderBottom: '1px solid var(--border-line-soft)', background: r.isFiel ? '#2fd67510' : 'transparent' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-panel-2)' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = r.isFiel ? '#2fd67510' : 'transparent' }}>
                          <td className="px-3.5 py-2.5"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                          <td className="px-3.5 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{r.cliente}</td>
                          <td className="px-3.5 py-2.5 font-mono text-xs" style={{ color: 'var(--text-dim)' }}>{cleanOs(r.os)}</td>
                          <td className="px-3.5 py-2.5">
                            {r.isFiel ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#2fd67526', color: '#2fd675' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="mr-1"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                Fiel
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 max-w-[190px] truncate" style={{ color: 'var(--text-dim)' }}>{r.email || '—'}</td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{r.celular || '—'}</td>
                          <td className="px-3.5 py-2.5 max-w-[160px] truncate" style={{ color: 'var(--text-muted)' }}>{r.veiculo || '—'}</td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.dataEnvioEmail || '—'}</td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{r.dataEnvioSms || '—'}</td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex gap-1.5 items-center">
                              {wa && (
                                <a href={wa} target="_blank" rel="noopener noreferrer" title="Enviar mensagem de reenvio via WhatsApp"
                                  onClick={() => onContatado(r.id, 'whatsapp')}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: '#2fd67526', color: '#2fd675' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Z"/></svg>
                                </a>
                              )}
                              {r.email && (
                                <a href={`mailto:${r.email}`} title="Reenviar via e-mail"
                                  onClick={() => onContatado(r.id, 'email')}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: '#4c8dff26', color: '#4c8dff' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>
                                </a>
                              )}
                              {r.contatado && (
                                <span title={`Contatado via ${r.contatado_canal || ''}`} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: '#f5a62326', color: '#f5a623' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                                </span>
                              )}
                              <button onClick={() => onDelete(r.id)} title="Remover registro"
                                className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer border-0" style={{ background: '#ff5a5f1a', color: '#ff5a5f' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
      <p className="text-[11px] uppercase tracking-widest font-bold mb-2.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 38, fontWeight: 800, lineHeight: 1, color: color || 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}
