'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AgendamentosTvPayload } from '@/lib/agendamentos'

function hora(h: string) { return h.slice(0, 5) }

function dataHora(valor: string | null) {
  if (!valor) return 'Ainda não houve sincronização'
  return new Date(valor).toLocaleString('pt-BR', {
    timeZone: 'America/Maceio',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function tom(situacao: string) {
  const s = situacao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (s === 'os' || s.includes('receb')) return { bg: '#e6f5ed', color: '#137548' }
  if (s.includes('nao compareceu') || s.includes('cancel')) return { bg: '#f2eeee', color: '#8b4b4b' }
  if (s.includes('confirm')) return { bg: '#fff2d6', color: '#9a620b' }
  return { bg: '#ffebec', color: '#b91b20' }
}

export function AgendamentosView() {
  const [dados, setDados] = useState<AgendamentosTvPayload | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    const carregar = () => fetch('/api/agendamentos/tv', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((json) => { if (ativo) { setDados(json); setErro(false) } })
      .catch(() => { if (ativo) setErro(true) })
    carregar()
    const timer = window.setInterval(carregar, 30_000)
    return () => { ativo = false; window.clearInterval(timer) }
  }, [])

  const recebidas = useMemo(() => dados?.agendamentos.filter((a) => {
    const s = a.situacao.toLowerCase()
    return s === 'os' || s.includes('receb')
  }).length ?? 0, [dados])

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <InfoCard label="Agendamentos hoje" value={String(dados?.agendamentos.length ?? 0)} detail="Registros ativos" />
        <InfoCard label="Motocicletas recebidas" value={String(recebidas)} detail="Com OS ou recepcionadas" />
        <InfoCard label="Última sincronização" value={dados?.sincronizado_em ? new Date(dados.sincronizado_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' }) : '—'} detail={dataHora(dados?.sincronizado_em ?? null)} />
      </section>

      <section className="rounded-2xl p-5 flex flex-wrap items-center gap-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-base font-semibold m-0">Painel da TV da recepção</h2>
          <p className="text-xs mt-1 mb-0" style={{ color: 'var(--text-muted)' }}>
            A visualização abre em tela cheia, atualiza automaticamente e oculta parte do nome e da placa dos clientes.
          </p>
        </div>
        <a href="/tv/agendamentos" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white text-[13px] font-semibold no-underline"
          style={{ background: 'linear-gradient(135deg, #e22127, #b60f14)', boxShadow: '0 10px 22px -12px #d7181dcc' }}>
          <IconTv /> Abrir modo TV
        </a>
      </section>

      {erro && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#ffeded', color: '#b42329', border: '1px solid #ffd0d1' }}>
          Não foi possível carregar os agendamentos. Verifique se a migração e as variáveis do servidor foram configuradas.
        </div>
      )}

      <section className="overflow-hidden rounded-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-line-soft)' }}>
          <div><h2 className="text-sm font-semibold m-0">Agenda sincronizada</h2><p className="text-[11px] mt-1 mb-0" style={{ color: 'var(--text-muted)' }}>Os dados abaixo vêm da listagem do MicroWork Cloud DMS.</p></div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0f7a5a' }}>Atualização automática</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead><tr style={{ background: 'var(--bg-panel-2)', color: 'var(--text-muted)' }}>
              {['Horário', 'Cliente', 'Motocicleta', 'Placa', 'Serviço', 'Consultor', 'Situação'].map((c) => <th key={c} className="px-4 py-2.5 text-left text-[9px] uppercase tracking-wider">{c}</th>)}
            </tr></thead>
            <tbody>
              {dados?.agendamentos.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--border-line-soft)' }}>
                  <td className="px-4 py-3 font-bold">{hora(a.hora_agendamento)}</td>
                  <td className="px-4 py-3 font-semibold">{a.nome_exibicao}</td>
                  <td className="px-4 py-3">{a.modelo || '—'}</td>
                  <td className="px-4 py-3 font-mono text-[10px]">{a.placa_exibicao || '—'}</td>
                  <td className="px-4 py-3">{a.tipo_os || '—'}</td>
                  <td className="px-4 py-3">{a.consultor || '—'}</td>
                  <td className="px-4 py-3"><span className="inline-flex rounded-full px-2 py-1 text-[9px] font-bold" style={tom(a.situacao)}>{a.situacao}</span></td>
                </tr>
              ))}
              {dados && !dados.agendamentos.length && (
                <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>Nenhum agendamento sincronizado para hoje.</td></tr>
              )}
              {!dados && !erro && <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>Carregando agenda…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-line-soft)' }}><span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>{label}</span><strong className="block text-3xl mt-2" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>{value}</strong><small className="block mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{detail}</small></div>
}

function IconTv() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 22h8M12 18v4"/></svg> }
