'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import type { AgendamentoTv, AgendamentosTvPayload } from '@/lib/agendamentos'
import { visualDoModelo } from '@/lib/motos-catalog'
import styles from '@/app/tv/agendamentos/tv.module.css'

const TIME_ZONE = 'America/Maceio'
const POR_PAGINA = 6

function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function classeSituacao(situacao: string) {
  const s = normalizar(situacao)
  if (s === 'os' || s.includes('receb') || s.includes('atendid') || s.includes('execucao')) return 'received'
  if (s.includes('nao compareceu') || s.includes('ausente')) return 'absent'
  if (s.includes('cancel') || s.includes('encerr') || s.includes('finaliz')) return 'closed'
  if (s.includes('confirm')) return 'confirmed'
  return 'scheduled'
}

function horaCurta(hora: string) {
  return hora.slice(0, 5)
}

function minutosDoDia(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function relogioLocal(agora: Date) {
  return agora.toLocaleTimeString('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
}

function minutosAgora(agora: Date) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(agora)
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

function distanciaHorario(hora: string, agora: Date) {
  const diff = minutosDoDia(hora) - minutosAgora(agora)
  if (diff > 60) return `em ${Math.floor(diff / 60)}h ${diff % 60}min`
  if (diff > 1) return `em ${diff} min`
  if (diff >= -10) return 'previsto agora'
  const atraso = Math.abs(diff)
  if (atraso >= 60) return `previsto há ${Math.floor(atraso / 60)}h ${atraso % 60}min`
  return `previsto há ${atraso} min`
}

function iniciais(nome: string) {
  return nome.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

function formatarSync(valor: string | null) {
  if (!valor) return 'Aguardando primeira sincronização'
  return `Atualizado às ${new Date(valor).toLocaleTimeString('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })}`
}

export function TvAgendamentos({ inicial, demo = false }: { inicial: AgendamentosTvPayload; demo?: boolean }) {
  const [dados, setDados] = useState(inicial)
  const [agora, setAgora] = useState(new Date())
  const [pagina, setPagina] = useState(0)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (demo) return
    const atualizar = async () => {
      try {
        const resposta = await fetch('/api/agendamentos/tv', { cache: 'no-store' })
        if (!resposta.ok) throw new Error()
        setDados(await resposta.json())
        setOnline(true)
      } catch {
        setOnline(false)
      }
    }
    const timer = window.setInterval(atualizar, 45_000)
    return () => window.clearInterval(timer)
  }, [demo])

  const classificacao = useMemo(() => dados.agendamentos.map((a) => ({ ...a, classe: classeSituacao(a.situacao) })), [dados])
  const recebidas = classificacao.filter((a) => a.classe === 'received').length
  const indisponiveis = classificacao.filter((a) => a.classe === 'absent' || a.classe === 'closed').length
  const aguardando = classificacao.filter((a) => ['scheduled', 'confirmed'].includes(a.classe)).length
  const proximo = classificacao.find((a) => ['scheduled', 'confirmed'].includes(a.classe)) ?? null
  const paginas = Math.max(1, Math.ceil(classificacao.length / POR_PAGINA))

  useEffect(() => {
    setPagina((atual) => Math.min(atual, paginas - 1))
    if (paginas <= 1) return
    const timer = window.setInterval(() => setPagina((atual) => (atual + 1) % paginas), 10_000)
    return () => window.clearInterval(timer)
  }, [paginas])

  const lista = classificacao.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const foto = visualDoModelo(proximo?.modelo ?? '').foto
  const dataExtenso = agora.toLocaleDateString('pt-BR', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Image src="/alagoas-motos-logo.png" width={223} height={42} alt="Alagoas Motos" priority />
          <div className={styles.brandText}>
            <strong>Recepção de serviços</strong>
            <span>Agenda de hoje · {dataExtenso}</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={`${styles.connection} ${online ? styles.connectionOk : styles.connectionError}`}>
            <i />{online ? 'Painel atualizado' : 'Tentando reconectar'}
          </div>
          <time className={styles.clock}>{relogioLocal(agora)}</time>
        </div>
      </header>

      <section className={styles.layout}>
        <div className={styles.leftColumn}>
          <article className={styles.heroCard}>
            <div className={styles.heroGlow} />
            {proximo ? (
              <>
                <div className={styles.heroCopy}>
                  <div className={styles.eyebrow}><span /> Próxima chegada</div>
                  <div className={styles.heroTimeRow}>
                    <strong>{horaCurta(proximo.hora_agendamento)}</strong>
                    <span>{distanciaHorario(proximo.hora_agendamento, agora)}</span>
                  </div>
                  <h1>{proximo.nome_exibicao}</h1>
                  <p>{proximo.modelo || 'Motocicleta Honda'}</p>
                  <div className={styles.heroDetails}>
                    <div><small>Placa</small><b>{proximo.placa_exibicao || 'Não informada'}</b></div>
                    <div><small>Serviço</small><b>{proximo.tipo_os || 'Serviço agendado'}</b></div>
                    <div><small>Consultor</small><b>{proximo.consultor || 'A definir'}</b></div>
                  </div>
                </div>
                <div className={styles.bikeStage}>
                  <div className={styles.bikeBadge}>{proximo.situacao}</div>
                  <Image src={foto} alt={proximo.modelo || 'Motocicleta agendada'} width={620} height={360} priority className={styles.bikeImage} />
                </div>
              </>
            ) : (
              <div className={styles.emptyHero}>
                <span>✓</span>
                <h1>Agenda concluída</h1>
                <p>Não há outra motocicleta aguardando recepção hoje.</p>
              </div>
            )}
          </article>

          <article className={styles.flowCard}>
            <div className={styles.cardHeading}>
              <div><span>Fluxo do dia</span><strong>{classificacao.length ? `${recebidas + indisponiveis} de ${classificacao.length} atualizados` : 'Sem agendamentos'}</strong></div>
              <span>{classificacao.length ? `${Math.round(((recebidas + indisponiveis) / classificacao.length) * 100)}%` : '0%'}</span>
            </div>
            <div className={styles.progress}><i style={{ width: `${classificacao.length ? ((recebidas + indisponiveis) / classificacao.length) * 100 : 0}%` }} /></div>
            <div className={styles.miniTimeline}>
              {classificacao.slice(0, 8).map((item) => (
                <div key={item.id} className={`${styles.miniStop} ${styles[`mini_${item.classe}`]}`}>
                  <b>{horaCurta(item.hora_agendamento)}</b><i /><span>{item.modelo || 'Moto'}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className={styles.rightColumn}>
          <div className={styles.stats}>
            <Stat label="Agendadas" value={classificacao.length} tone="red" />
            <Stat label="Aguardando" value={aguardando} tone="amber" />
            <Stat label="Recebidas" value={recebidas} tone="green" />
          </div>

          <article className={styles.agendaCard}>
            <div className={styles.agendaTitle}>
              <div><span>Agenda de hoje</span><strong>{classificacao.length} serviços</strong></div>
              {paginas > 1 && <em>{pagina + 1}/{paginas}</em>}
            </div>
            <div className={styles.agendaList}>
              {lista.length ? lista.map((item) => <AgendaRow key={item.id} item={item} classe={item.classe} />) : (
                <div className={styles.emptyList}>Os agendamentos sincronizados aparecerão aqui.</div>
              )}
            </div>
          </article>

          <footer className={styles.syncFooter}>
            <span className={online ? styles.syncDot : styles.syncDotError} />
            <div><strong>{formatarSync(dados.sincronizado_em)}</strong><small>Atualização automática a cada 45 segundos</small></div>
          </footer>
        </aside>
      </section>
    </main>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`${styles.statCard} ${styles[`stat_${tone}`]}`}><span>{label}</span><strong>{String(value).padStart(2, '0')}</strong><i /></div>
}

function AgendaRow({ item, classe }: { item: AgendamentoTv; classe: string }) {
  return (
    <div className={`${styles.agendaRow} ${styles[`row_${classe}`]}`}>
      <time>{horaCurta(item.hora_agendamento)}</time>
      <div className={styles.avatar}>{iniciais(item.nome_exibicao)}</div>
      <div className={styles.rowText}><strong>{item.nome_exibicao}</strong><span>{item.modelo || 'Modelo não informado'} · {item.tipo_os || 'Serviço'}</span></div>
      <span className={styles.status}>{item.situacao}</span>
    </div>
  )
}
