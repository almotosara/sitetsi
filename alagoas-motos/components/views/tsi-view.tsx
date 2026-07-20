'use client'

import { useMemo } from 'react'
import type { TsiRow } from '@/lib/types'
import { TSI_META, TSI_META_PESQ, TSI_CATS, tsiColor, tsiPesqColor } from '@/lib/constants'

interface TsiViewProps {
  tsiData: TsiRow[]
  tsiUpdatedAt: string | null
  onImport: () => void
}

const COLORS: Record<string, string> = { green: '#2fd675', yellow: '#ffc400', red: '#ff5a5f' }

interface LojaAgg { t2bSum: number; t2bCount: number; osCount: number }
interface CellAgg { osCount: number; t2bSum: number; t2bCount: number }

export function TsiView({ tsiData, tsiUpdatedAt, onImport }: TsiViewProps) {
  const m = useMemo(() => {
    let sumT2B = 0, cntT2B = 0, sumTsi = 0, cntTsi = 0
    const lojas: Record<string, LojaAgg> = {}
    const matriz: Record<string, Record<string, CellAgg>> = {}
    const feedbacks: TsiRow[] = []
    const alertas: TsiRow[] = []

    tsiData.forEach((r) => {
      const loja = r.loja || 'Desconhecido'
      const cilindrada = r.cilindrada || 'Não Informado'
      const t2b = Number(r.t2b ?? 0)
      const tsi = Number(r.tsi ?? 0)

      sumT2B += t2b; cntT2B++
      sumTsi += tsi; cntTsi++
      if (t2b < 100) alertas.push(r)

      if (!lojas[loja]) lojas[loja] = { t2bSum: 0, t2bCount: 0, osCount: 0 }
      lojas[loja].osCount++
      lojas[loja].t2bSum += t2b; lojas[loja].t2bCount++

      if (!matriz[loja]) {
        matriz[loja] = {}
        TSI_CATS.forEach((c) => { matriz[loja][c] = { osCount: 0, t2bSum: 0, t2bCount: 0 } })
      }
      if (matriz[loja][cilindrada]) {
        matriz[loja][cilindrada].osCount++
        matriz[loja][cilindrada].t2bSum += t2b; matriz[loja][cilindrada].t2bCount++
      }

      if (r.comentario && r.comentario !== 'NaN') feedbacks.push(r)
    })

    const avgT2B = cntT2B > 0 ? sumT2B / cntT2B : 0
    const avgTsi = cntTsi > 0 ? sumTsi / cntTsi : 0
    const sortedLojas = Object.keys(lojas).sort((a, b) => {
      const av = lojas[a].t2bCount > 0 ? lojas[a].t2bSum / lojas[a].t2bCount : 0
      const bv = lojas[b].t2bCount > 0 ? lojas[b].t2bSum / lojas[b].t2bCount : 0
      return bv - av
    })
    alertas.sort((a, b) => (Number(a.t2b) || 0) - (Number(b.t2b) || 0))

    return { total: tsiData.length, avgT2B, avgTsi, lojas, matriz, feedbacks, alertas, sortedLojas }
  }, [tsiData])

  return (
    <div className="view-enter flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>TSI — Top2Box</h2>
          {tsiUpdatedAt ? (
            <p className="text-[11.5px] mt-1 flex items-center gap-1.5 font-semibold" style={{ color: '#2fd675' }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#2fd675' }} />
              Última atualização: {tsiUpdatedAt}
            </p>
          ) : (
            <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Nenhuma planilha importada ainda.</p>
          )}
        </div>
        <button onClick={onImport}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[9px] text-white font-semibold text-[13.5px] cursor-pointer hover:brightness-110 transition-all"
          style={{ background: 'linear-gradient(135deg, #ff4b2b, #d63a1e)', border: '1px solid #ff4b2b', boxShadow: '0 6px 16px -6px #ff4b2b70' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>
          Anexar planilha TSI
        </button>
      </div>

      {tsiData.length === 0 ? (
        <div className="rounded-2xl p-12 text-center cursor-pointer transition-colors" style={{ border: '2px dashed var(--border-line)', color: 'var(--text-muted)' }}
          onClick={onImport} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ff4b2b'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-line)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-50"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>
          <p className="font-semibold mb-1">Nenhuma pesquisa carregada</p>
          <p className="text-sm">Clique aqui ou no botão acima para importar o arquivo .xlsx/.csv exportado.</p>
          <p className="text-xs mt-2.5">
            Meta mínima Top2Box: <b style={{ color: '#2fd675' }}>≥ {TSI_META.toFixed(1)}</b> · Meta de pesquisas por loja: <b>{TSI_META_PESQ}</b>
          </p>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <KpiCard label="Pesquisas" value={String(m.total)} />
            <KpiCard label="Média Geral Top2Box" value={m.avgT2B.toFixed(1)} color={COLORS[tsiColor(m.avgT2B)]} sub={`meta ≥ ${TSI_META.toFixed(1)}`} />
            <KpiCard label="Média Satisfação (TSI)" value={m.avgTsi.toFixed(1)} />
          </div>

          {/* Gauges */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Section title="Velocímetro Top2Box" sub="| nota média geral">
              <Gauge score={m.avgT2B} label="Top2Box" />
            </Section>
            <Section title="Velocímetro Satisfação (TSI)" sub="| nota média geral">
              <Gauge score={m.avgTsi} label="TSI" />
            </Section>
          </div>

          {/* Ranking + Matriz */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.1fr' }}>
            <Section title="Desempenho por Loja (Ranking)" sub={`| meta de ${TSI_META_PESQ} pesquisas`}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      {['Loja', 'Pesq.', 'Top2Box', 'Falta', 'Meta'].map((h, i) => (
                        <th key={h} className="px-2.5 py-2 text-[10.5px] uppercase tracking-widest font-bold whitespace-nowrap"
                          style={{
                            background: 'var(--bg-panel-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-line-soft)',
                            textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center',
                          }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.sortedLojas.map((loja) => {
                      const g = m.lojas[loja]
                      const avg = g.t2bCount > 0 ? g.t2bSum / g.t2bCount : 0
                      const isMeta = avg >= TSI_META
                      let missing: React.ReactNode = <span style={{ color: '#2fd675', fontWeight: 700 }}>-</span>
                      if (!isMeta && g.t2bCount > 0) {
                        const needed = TSI_META * g.t2bCount - g.t2bSum
                        const x = Math.ceil(needed / (100 - TSI_META))
                        missing = <Badge kind="warn">+{x}</Badge>
                      }
                      const pc = COLORS[tsiPesqColor(g.osCount)]
                      const ac = COLORS[tsiColor(avg)]
                      return (
                        <tr key={loja} className="last:border-0" style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
                          <td className="px-2.5 py-2.5 font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{loja}</td>
                          <td className="px-2.5 py-2.5 text-center font-extrabold" style={{ color: pc }}>{g.osCount}</td>
                          <td className="px-2.5 py-2.5 text-right font-extrabold" style={{ color: ac }}>{avg.toFixed(1)}</td>
                          <td className="px-2.5 py-2.5 text-center">{missing}</td>
                          <td className="px-2.5 py-2.5 text-center"><Badge kind={isMeta ? 'ok' : 'fail'}>{isMeta ? 'Atingida' : 'Abaixo'}</Badge></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Matriz: Lojas x Cilindradas" sub={`| meta ${TSI_META.toFixed(1)} por cilindrada`}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      {['Loja', ...TSI_CATS].map((h, i) => (
                        <th key={h} className="px-2 py-2 text-[10.5px] uppercase tracking-widest font-bold whitespace-nowrap"
                          style={{
                            background: 'var(--bg-panel-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-line-soft)',
                            textAlign: i === 0 ? 'left' : 'center',
                          }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.sortedLojas.map((loja) => (
                      <tr key={loja} className="last:border-0" style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
                        <td className="px-2 py-2.5 font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{loja}</td>
                        {TSI_CATS.map((cat) => {
                          const cell = m.matriz[loja]?.[cat]
                          if (cell && cell.osCount > 0) {
                            const avg = cell.t2bCount > 0 ? cell.t2bSum / cell.t2bCount : 0
                            const ok = avg >= TSI_META
                            return (
                              <td key={cat} className="text-center font-bold text-[13px]"
                                style={{
                                  border: '1px solid var(--border-line-soft)', padding: '0 8px', height: 44,
                                  background: ok ? '#2fd67522' : '#ff5a5f22', color: ok ? '#2fd675' : '#ff5a5f',
                                }}>
                                {avg.toFixed(1)} <span style={{ opacity: 0.8, fontWeight: 600 }}>({cell.osCount})</span>
                              </td>
                            )
                          }
                          return (
                            <td key={cat} className="text-center text-[13px]"
                              style={{ border: '1px solid var(--border-line-soft)', padding: '0 8px', height: 44, color: 'var(--text-muted)', opacity: 0.4, fontWeight: 400 }}>-</td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          {/* Alertas */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)', borderLeft: '3px solid #ffc400' }}>
            <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 17, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary)', borderLeft: '3px solid #ffc400', paddingLeft: 10 }}>
              Monitoramento de Alertas <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>| Top2Box abaixo de 100</span>
            </h3>
            {m.alertas.length === 0 ? (
              <div className="text-center py-5 text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma pesquisa Top2Box abaixo de 100.</div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {m.alertas.map((a) => (
                  <div key={a.id} className="rounded-lg px-3.5 py-3" style={{ background: 'var(--bg-panel-2)', border: '1px solid var(--border-line-soft)' }}>
                    <div className="flex justify-between font-bold text-[12.5px] mb-1" style={{ color: '#ffc400' }}>
                      <span>OS: {a.os}</span><span>{a.loja}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Top2Box: <span style={{ color: COLORS[tsiColor(Number(a.t2b ?? 0))], fontWeight: 800 }}>{Number(a.t2b ?? 0)}</span>
                      {'  |  '}
                      TSI: <span style={{ fontWeight: 700, color: 'var(--text-dim)' }}>{Number(a.tsi ?? 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedbacks */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
            <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)', borderLeft: '3px solid #ff4b2b', paddingLeft: 10 }}>
              Mural de Feedbacks e Elogios
            </h3>
            <ul className="list-none m-0 p-0">
              {m.feedbacks.length === 0 ? (
                <li className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>Sem comentários registrados nas pesquisas.</li>
              ) : m.feedbacks.map((f) => {
                const isElogio = f.tipo === 'Elogio'
                return (
                  <li key={f.id} className="py-3.5 last:border-0" style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
                    <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <div className="flex items-center gap-2">
                        <Badge kind={isElogio ? 'ok' : 'info'}>{f.tipo || 'Comentário'}</Badge>
                        <strong style={{ color: 'var(--text-dim)' }}>{f.loja}</strong>
                      </div>
                      <div className="font-semibold">OS: {f.os}{f.data ? `  |  ${f.data}` : ''}</div>
                    </div>
                    <div className="text-[13.5px] italic rounded-lg px-3.5 py-3" style={{ color: 'var(--text-dim)', background: 'var(--bg-panel-2)', borderLeft: '3px solid var(--border-line)' }}>
                      &ldquo;{f.comentario}&rdquo;
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
      <p className="text-[11px] uppercase tracking-widest font-bold mb-2.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 38, fontWeight: 800, lineHeight: 1, color: color || 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
      <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 17, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary)', borderLeft: '3px solid #ff4b2b', paddingLeft: 10 }}>
        {title} {sub && <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
      </h3>
      {children}
    </div>
  )
}

function Badge({ kind, children }: { kind: 'ok' | 'fail' | 'warn' | 'info'; children: React.ReactNode }) {
  const styles: Record<string, React.CSSProperties> = {
    ok: { background: '#2fd67526', color: '#2fd675' },
    fail: { background: '#ff5a5f26', color: '#ff5a5f' },
    warn: { background: '#ffc40033', color: '#ffc400' },
    info: { background: '#4c8dff26', color: '#4c8dff' },
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold" style={styles[kind]}>
      {children}
    </span>
  )
}

function Gauge({ score, label }: { score: number; label: string }) {
  const s = isNaN(score) ? 0 : Math.max(0, Math.min(100, score))
  const col = COLORS[tsiColor(s)]
  const R = 80, CX = 100, CY = 100
  const polar = (r: number, angDeg: number): [number, number] => {
    const a = ((angDeg - 90) * Math.PI) / 180
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
  }
  const A0 = -90, A1 = 90
  const [bx0, by0] = polar(R, A0)
  const [bx1, by1] = polar(R, A1)
  const bg = `M ${bx0} ${by0} A ${R} ${R} 0 0 1 ${bx1} ${by1}`
  const valAng = A0 + (A1 - A0) * (s / 100)
  const [vx, vy] = polar(R, valAng)
  const largeVal = valAng - A0 <= 180 ? 0 : 1
  const fg = `M ${bx0} ${by0} A ${R} ${R} 0 ${largeVal} 1 ${vx} ${vy}`
  const [px, py] = polar(R - 14, valAng)
  const metaAng = A0 + (A1 - A0) * (TSI_META / 100)
  const [mx0, my0] = polar(R + 6, metaAng)
  const [mx1, my1] = polar(R - 10, metaAng)

  return (
    <div className="flex flex-col items-center justify-center pt-1.5 pb-0.5">
      <svg viewBox="0 0 200 130" width="100%" style={{ maxWidth: 260, overflow: 'visible' }}>
        <path d={bg} fill="none" stroke="var(--border-line-soft)" strokeWidth={14} strokeLinecap="round" />
        <path d={fg} fill="none" stroke={col} strokeWidth={14} strokeLinecap="round" style={{ transition: 'stroke-dasharray .6s cubic-bezier(.4,0,.2,1)' }} />
        <line x1={mx0} y1={my0} x2={mx1} y2={my1} stroke="var(--text-primary)" strokeWidth={2} strokeDasharray="2 2" />
        <line x1={CX} y1={CY} x2={px} y2={py} stroke={col} strokeWidth={3} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={6} fill={col} />
        <text x={CX} y={CY - 18} textAnchor="middle" fontSize={30} fontWeight={800} fill={col} fontFamily="Rajdhani, sans-serif">
          {isNaN(score) ? '—' : s.toFixed(1)}
        </text>
      </svg>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 14, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-primary)', marginTop: 10 }}>
        {label} <span style={{ color: 'var(--text-muted)' }}>· meta {TSI_META.toFixed(1)}</span>
      </div>
    </div>
  )
}
