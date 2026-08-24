'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  Gauge,
  Handshake,
  HeartHandshake,
  Mail,
  MessageSquareText,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  SmilePlus,
  Smartphone,
  Upload,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'

import { ShinyButton } from '@/components/ui/shiny-button'
import { TSI_META, TSI_STORE_MAP, TSI_YELLOW } from '@/lib/constants'
import type { TsiBlockRatings, TsiResendRow, TsiRow } from '@/lib/types'

import styles from './tsi-detail-view.module.css'

interface TsiDetailViewProps {
  tsiData: TsiRow[]
  tsiResend: TsiResendRow[]
  tsiUpdatedAt: string | null
  onImport: () => void
}

type Tone = 'red' | 'amber' | 'green' | 'blue' | 'neutral'

interface MonthMetric {
  key: string
  label: string
  score: number
  responses: number
  feedbacks: number
}

interface StoreMetric {
  name: string
  score: number
  responses: number
}

interface BlockScoreMetric {
  score: number | null
  responses: number
  values: number[]
}

const clampScore = (value: number | null | undefined) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
}

const normalize = (value: string | null | undefined) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/\s+/g, ' ')
  .trim()

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const raw = value.trim().split(' ')[0]
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const parsed = br
    ? new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]))
    : iso
      ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
      : new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date, long = false) {
  const formatted = date.toLocaleDateString('pt-BR', long
    ? { month: 'long', year: 'numeric' }
    : { month: 'short', year: '2-digit' })
  return formatted.replace('.', '')
}

function storeName(value: string | null) {
  if (!value) return 'Não informado'
  return TSI_STORE_MAP[value] || value
}

function average(rows: TsiRow[], selector: (row: TsiRow) => number) {
  return rows.length ? rows.reduce((sum, row) => sum + selector(row), 0) / rows.length : 0
}

function hasNumericScore(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
}

function buildBlockScore(rows: TsiRow[], key: keyof TsiBlockRatings): BlockScoreMetric {
  const values = rows
    .map((row) => row.detalhamento?.[key])
    .filter(hasNumericScore)
    .map(Number)
  return {
    values,
    responses: values.length,
    score: values.length ? (values.filter((value) => value >= 9).length / values.length) * 100 : null,
  }
}

function toneForBlockScore(value: number | null): Tone {
  if (value === null) return 'neutral'
  if (value >= 90) return 'green'
  if (value >= 80) return 'amber'
  return 'red'
}

function formatBlockScore(value: number | null) {
  return value === null
    ? '—'
    : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toneForScore(value: number): Tone {
  if (value >= TSI_META) return 'green'
  if (value >= TSI_YELLOW) return 'amber'
  return 'red'
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'Aguardando primeira importação'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return `Base atualizada em ${value}`
  return `Base atualizada em ${parsed.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).replace('.', '')}`
}

function buildMonths(rows: TsiRow[]): MonthMetric[] {
  const groups = new Map<string, { date: Date; sum: number; responses: number; feedbacks: number }>()

  rows.forEach((row) => {
    if (!hasNumericScore(row.t2b)) return
    const date = parseDate(row.data)
    if (!date) return
    const key = monthKey(date)
    const current = groups.get(key) || { date, sum: 0, responses: 0, feedbacks: 0 }
    current.sum += clampScore(row.t2b)
    current.responses += 1
    if (row.comentario && normalize(row.comentario) !== 'nan') current.feedbacks += 1
    groups.set(key, current)
  })

  return Array.from(groups.entries())
    .sort(([, left], [, right]) => left.date.getTime() - right.date.getTime())
    .slice(-7)
    .map(([key, group]) => ({
      key,
      label: monthLabel(group.date),
      score: group.responses ? group.sum / group.responses : 0,
      responses: group.responses,
      feedbacks: group.feedbacks,
    }))
}

function buildStores(rows: TsiRow[]): StoreMetric[] {
  const stores = new Map<string, { sum: number; responses: number }>()
  rows.forEach((row) => {
    if (!hasNumericScore(row.t2b)) return
    const name = storeName(row.loja)
    const current = stores.get(name) || { sum: 0, responses: 0 }
    current.sum += clampScore(row.t2b)
    current.responses += 1
    stores.set(name, current)
  })

  return Array.from(stores.entries())
    .map(([name, metric]) => ({
      name,
      responses: metric.responses,
      score: metric.responses ? metric.sum / metric.responses : 0,
    }))
    .sort((left, right) => right.score - left.score)
}

export function TsiDetailView({ tsiData, tsiResend, tsiUpdatedAt, onImport }: TsiDetailViewProps) {
  const [segment, setSegment] = useState('all')
  const [category, setCategory] = useState('all')

  const segments = useMemo(() => Array.from(new Set(tsiData.map((row) => storeName(row.loja))))
    .sort((left, right) => left.localeCompare(right, 'pt-BR')), [tsiData])
  const categories = useMemo(() => Array.from(new Set(tsiData.map((row) => row.cilindrada || 'Não informado')))
    .sort((left, right) => left.localeCompare(right, 'pt-BR')), [tsiData])

  const filteredRows = useMemo(() => tsiData.filter((row) => (
    (segment === 'all' || storeName(row.loja) === segment)
    && (category === 'all' || (row.cilindrada || 'Não informado') === category)
  )), [category, segment, tsiData])

  const datedRows = useMemo(() => filteredRows
    .map((row) => ({ row, date: parseDate(row.data) }))
    .filter((item): item is { row: TsiRow; date: Date } => Boolean(item.date)), [filteredRows])

  const anchorDate = useMemo(() => datedRows.reduce<Date | null>((latest, item) => (
    !latest || item.date > latest ? item.date : latest
  ), null) || new Date(), [datedRows])

  const periodRows = useMemo(() => {
    if (!datedRows.length) return filteredRows
    const anchorKey = monthKey(anchorDate)
    return datedRows.filter((item) => monthKey(item.date) === anchorKey).map((item) => item.row)
  }, [anchorDate, datedRows, filteredRows])

  const metrics = useMemo(() => {
    const scoredRows = periodRows.filter((row) => hasNumericScore(row.t2b))
    const tsiRows = periodRows.filter((row) => hasNumericScore(row.tsi))
    const avgT2b = average(scoredRows, (row) => clampScore(row.t2b))
    const avgTsi = average(tsiRows, (row) => clampScore(row.tsi))
    const goal = scoredRows.filter((row) => clampScore(row.t2b) >= TSI_META).length
    const attention = scoredRows.filter((row) => {
      const value = clampScore(row.t2b)
      return value >= TSI_YELLOW && value < TSI_META
    }).length
    const critical = Math.max(0, scoredRows.length - goal - attention)
    const feedbacks = periodRows.filter((row) => row.comentario && normalize(row.comentario) !== 'nan')
    const praise = feedbacks.filter((row) => normalize(row.tipo).includes('elogio')).length
    const suggestions = feedbacks.length - praise
    const perfect = scoredRows.filter((row) => clampScore(row.t2b) >= 99.5).length
    const stores = new Set(periodRows.map((row) => storeName(row.loja))).size
    const productCategories = new Set(periodRows.map((row) => row.cilindrada || 'Não informado')).size
    const uniqueOrders = new Set(periodRows.map((row) => normalize(row.os)).filter(Boolean)).size
    return {
      avgT2b,
      avgTsi,
      responses: scoredRows.length,
      goal,
      attention,
      critical,
      feedbacks: feedbacks.length,
      praise,
      suggestions,
      perfect,
      stores,
      productCategories,
      uniqueOrders,
      goalPercent: scoredRows.length ? (goal / scoredRows.length) * 100 : 0,
    }
  }, [periodRows])

  const blockMetrics = useMemo(() => ({
    satisfacaoGeral: buildBlockScore(periodRows, 'satisfacaoGeral'),
    infraestrutura: buildBlockScore(periodRows, 'infraestrutura'),
    consultor: buildBlockScore(periodRows, 'consultor'),
    qualidade: buildBlockScore(periodRows, 'qualidade'),
    entrega: buildBlockScore(periodRows, 'entrega'),
    custoBeneficio: buildBlockScore(periodRows, 'custoBeneficio'),
    recomendacao: buildBlockScore(periodRows, 'recomendacao'),
    retornoFuturo: buildBlockScore(periodRows, 'retornoFuturo'),
    agendamento: buildBlockScore(periodRows, 'agendamento'),
    recepcao: buildBlockScore(periodRows, 'recepcao'),
  }), [periodRows])

  const hasBlockDetails = Object.values(blockMetrics).some((metric) => metric.responses > 0)
  const blockResponseCount = blockMetrics.satisfacaoGeral.responses || metrics.responses

  const monthMetrics = useMemo(() => buildMonths(filteredRows), [filteredRows])
  const storeMetrics = useMemo(() => buildStores(periodRows), [periodRows])

  const resendMetrics = useMemo(() => {
    const respondedOrders = new Set(tsiData.map((row) => normalize(row.os)).filter(Boolean))
    const emails = tsiResend.filter((row) => Boolean(row.data_envio_email)).length
    const sms = tsiResend.filter((row) => Boolean(row.data_envio_sms)).length
    const resent = tsiResend.filter((row) => Boolean(row.data_reenvio)).length
    const pending = tsiResend.filter((row) => {
      const order = normalize(row.os)
      return !row.data_reenvio && (!order || !respondedOrders.has(order))
    }).length
    return { emails, sms, resent, pending }
  }, [tsiData, tsiResend])

  if (!tsiData.length) {
    return (
      <section className={`${styles.detailPage} view-enter`} aria-label="Detalhamento TSI">
        <div className={styles.emptyState}>
          <span><ClipboardList size={29} /></span>
          <h2>O detalhamento será montado com a base TSI</h2>
          <p>Importe a planilha para visualizar o resultado por período, loja, categoria, indicadores operacionais e RACs.</p>
          <ShinyButton onClick={onImport} size="default"><Upload size={17} /> Importar planilha TSI</ShinyButton>
        </div>
      </section>
    )
  }

  const periodName = monthLabel(anchorDate, true)

  return (
    <section className={`${styles.detailPage} view-enter`} aria-label="Detalhamento TSI por blocos">
      <header className={styles.pageHeader}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}><Activity size={14} /> Resultados Pesquisa TSI 2.0</span>
          <h2>Detalhamento operacional</h2>
          <p>Indicadores de satisfação, respostas e oportunidades organizados por blocos.</p>
          <small><i /> {formatUpdatedAt(tsiUpdatedAt)} · período de referência: {periodName}</small>
        </div>

        <div className={styles.headerActions}>
          <label>
            <span>Segmento</span>
            <select value={segment} onChange={(event) => setSegment(event.target.value)}>
              <option value="all">Todas as lojas</option>
              {segments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Categoria Produto</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Todas as categorias</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button type="button" className={styles.refreshButton} onClick={() => { setSegment('all'); setCategory('all') }}>
            <RefreshCw size={16} /> Limpar filtros
          </button>
        </div>
      </header>

      <DetailSection title="Nota Top2Box" subtitle={`Leitura consolidada de ${periodName}`} icon={<Gauge size={18} />}>
        <div className={styles.heroGrid}>
          <article className={`${styles.contentCard} ${styles.trendCard}`}>
            <CardHeading title="Evolução mensal Top2Box" subtitle="Últimos períodos com respostas" />
            <ScoreTrendChart points={monthMetrics} />
          </article>

          <article className={`${styles.contentCard} ${styles.gaugeCard}`}>
            <CardHeading title="Resultado Top2Box" subtitle={periodName} />
            <ScoreGauge value={metrics.avgT2b} />
            <span className={styles.periodFoot}>{metrics.responses} respostas válidas no período</span>
          </article>

          <article className={`${styles.contentCard} ${styles.storeCard}`}>
            <CardHeading title="Top2Box por loja" subtitle={periodName} />
            <StoreBars stores={storeMetrics} />
          </article>
        </div>
      </DetailSection>

      <DetailSection title="Nota Top2Box por bloco" subtitle={`Indicadores de ${periodName}`} icon={<BarChart3 size={18} />}>
        {!hasBlockDetails && (
          <div className={styles.blockImportNotice}>
            Execute a migração <code>supabase-tsi-detalhamento.sql</code> e reimporte a planilha TSI para preencher as notas de cada área.
          </div>
        )}
        <div className={styles.blockGrid}>
          <MetricBlock label="Pesquisas respondidas" value={String(blockResponseCount)} note="respostas válidas no período" tone="blue" icon={<UsersRound size={17} />} />
          <AreaMetricBlock label="Infraestrutura" metric={blockMetrics.infraestrutura} icon={<Building2 size={17} />} />
          <AreaMetricBlock label="Consultor" metric={blockMetrics.consultor} icon={<UserRoundCheck size={17} />} />
          <AreaMetricBlock label="Qualidade" metric={blockMetrics.qualidade} icon={<ShieldCheck size={17} />} />
          <AreaMetricBlock label="Entrega" metric={blockMetrics.entrega} icon={<PackageCheck size={17} />} />
          <AreaMetricBlock label="Custo-benefício" metric={blockMetrics.custoBeneficio} icon={<BadgeDollarSign size={17} />} />
          <SatisfactionDistribution metric={blockMetrics.satisfacaoGeral} />
          <AreaMetricBlock label="Satisfação geral" metric={blockMetrics.satisfacaoGeral} icon={<SmilePlus size={17} />} />
          <AreaMetricBlock label="Recomendação" metric={blockMetrics.recomendacao} icon={<HeartHandshake size={17} />} />
          <AreaMetricBlock label="Retorno futuro" metric={blockMetrics.retornoFuturo} icon={<RotateCcw size={17} />} />
          <AreaMetricBlock label="Agendamento" metric={blockMetrics.agendamento} icon={<CalendarCheck2 size={17} />} />
          <AreaMetricBlock label="Recepção" metric={blockMetrics.recepcao} icon={<Handshake size={17} />} />
        </div>
      </DetailSection>

      <DetailSection title="Indicadores da base de dados" subtitle="Cruzamento com a base de reenvio TSI" icon={<ClipboardList size={18} />}>
        <div className={styles.databaseGrid}>
          <DatabaseMetric icon={<CalendarDays size={19} />} label="Ordens de serviço" value={metrics.uniqueOrders} note={`Pesquisadas em ${periodName}`} tone="red" />
          <DatabaseMetric icon={<Mail size={19} />} label="Envios de e-mail" value={resendMetrics.emails} note="Registros com envio identificado" tone="blue" />
          <DatabaseMetric icon={<Smartphone size={19} />} label="Envios de SMS" value={resendMetrics.sms} note="Registros com SMS identificado" tone="green" />
          <DatabaseMetric icon={<Send size={19} />} label="Pesquisas para reenvio" value={resendMetrics.pending} note={`${resendMetrics.resent} reenvios já registrados`} tone="amber" />
        </div>
      </DetailSection>

      <DetailSection title="RACs TSI" subtitle="Comentários registrados por mês" icon={<MessageSquareText size={18} />}>
        <RacChart months={monthMetrics} />
      </DetailSection>
    </section>
  )
}

function DetailSection({ title, subtitle, icon, children }: {
  title: string
  subtitle: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className={styles.sectionBlock}>
      <header className={styles.sectionHeader}>
        <span>{icon}</span>
        <div><h3>{title}</h3><p>{subtitle}</p></div>
      </header>
      {children}
    </section>
  )
}

function CardHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <header className={styles.cardHeading}><div><h4>{title}</h4><p>{subtitle}</p></div><Activity size={15} /></header>
}

function MetricBlock({ label, value, note, tone, icon }: {
  label: string
  value: string
  note: string
  tone: Tone
  icon: ReactNode
}) {
  return (
    <article className={styles.metricBlock} data-tone={tone}>
      <header><span>{icon}</span><small>{label}</small></header>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  )
}

function AreaMetricBlock({ label, metric, icon }: {
  label: string
  metric: BlockScoreMetric
  icon: ReactNode
}) {
  return (
    <MetricBlock
      label={label}
      value={formatBlockScore(metric.score)}
      note={metric.responses
        ? `Top2Box · ${metric.responses} ${metric.responses === 1 ? 'resposta válida' : 'respostas válidas'}`
        : 'Aguardando reimportação da planilha'}
      tone={toneForBlockScore(metric.score)}
      icon={icon}
    />
  )
}

function SatisfactionDistribution({ metric }: { metric: BlockScoreMetric }) {
  const counts = new Map<number, number>()
  metric.values.forEach((value) => {
    const scoreValue = Math.max(0, Math.min(10, Math.round(value)))
    counts.set(scoreValue, (counts.get(scoreValue) || 0) + 1)
  })
  const entries = Array.from(counts.entries()).sort(([left], [right]) => right - left)
  const max = Math.max(1, ...entries.map(([, count]) => count))

  return (
    <article className={`${styles.metricBlock} ${styles.distributionBlock}`} data-tone={entries.length ? 'blue' : 'neutral'}>
      <header><span><BarChart3 size={17} /></span><small>Satisfação geral · distribuição</small></header>
      {entries.length ? (
        <div className={styles.distributionBars} aria-label="Quantidade de respostas por nota de satisfação geral">
          {entries.map(([scoreValue, count]) => (
            <div key={scoreValue}>
              <span>{count}</span>
              <i><b style={{ height: `${Math.max(7, (count / max) * 100)}%` }} /></i>
              <small>{scoreValue}</small>
            </div>
          ))}
        </div>
      ) : <strong>—</strong>}
      <p>{metric.responses ? `${metric.responses} respostas válidas` : 'Aguardando reimportação da planilha'}</p>
    </article>
  )
}

function DatabaseMetric({ icon, label, value, note, tone }: {
  icon: ReactNode
  label: string
  value: number
  note: string
  tone: Tone
}) {
  return (
    <article className={styles.databaseMetric} data-tone={tone}>
      <span>{icon}</span>
      <div><small>{label}</small><strong>{value.toLocaleString('pt-BR')}</strong><p>{note}</p></div>
    </article>
  )
}

function ScoreGauge({ value }: { value: number }) {
  const safeValue = clampScore(value)
  const angle = Math.PI - (safeValue / 100) * Math.PI
  const needleX = 124 + Math.cos(angle) * 70
  const needleY = 124 - Math.sin(angle) * 70
  return (
    <div className={styles.gaugeWrap} data-tone={toneForScore(safeValue)}>
      <svg viewBox="0 0 248 150" role="img" aria-label={`Resultado Top2Box ${safeValue.toFixed(1)} por cento`}>
        <path d="M 28 124 A 96 96 0 0 1 220 124" pathLength="100" className={styles.gaugeTrack} />
        <path d="M 28 124 A 96 96 0 0 1 220 124" pathLength="100" className={styles.gaugeProgress} strokeDasharray={`${safeValue} 100`} />
        <line x1="124" y1="124" x2={needleX} y2={needleY} className={styles.gaugeNeedle} />
        <circle cx="124" cy="124" r="7" className={styles.gaugeCenter} />
        <text x="28" y="145">0</text><text x="208" y="145">100</text>
      </svg>
      <div><strong>{safeValue.toFixed(1)}%</strong><span>{safeValue >= TSI_META ? 'Meta atingida' : safeValue >= TSI_YELLOW ? 'Em atenção' : 'Abaixo da meta'}</span></div>
    </div>
  )
}

function ScoreTrendChart({ points }: { points: MonthMetric[] }) {
  if (!points.length) return <div className={styles.noData}>Sem datas suficientes para montar a evolução.</div>
  const width = 680
  const height = 240
  const px = 34
  const top = 24
  const bottom = 42
  const plotWidth = width - px * 2
  const plotHeight = height - top - bottom
  const floor = Math.max(0, Math.min(88, Math.floor(Math.min(...points.map((item) => item.score), TSI_META) - 5)))
  const x = (index: number) => px + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
  const y = (value: number) => top + (1 - (value - floor) / Math.max(1, 100 - floor)) * plotHeight
  const coords = points.map((point, index) => ({ ...point, x: x(index), y: y(point.score) }))
  const path = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const area = `${path} L ${coords.at(-1)!.x} ${height - bottom} L ${coords[0].x} ${height - bottom} Z`
  const goalY = y(TSI_META)

  return (
    <div className={styles.scoreTrend}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evolução mensal Top2Box">
        <defs><linearGradient id="tsiDetailArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity=".34"/><stop offset="100%" stopColor="#ef4444" stopOpacity="0"/></linearGradient></defs>
        {[0, 1, 2, 3].map((line) => {
          const lineY = top + (plotHeight / 3) * line
          return <line key={line} x1={px} x2={width - px} y1={lineY} y2={lineY} className={styles.chartGridLine} />
        })}
        <line x1={px} x2={width - px} y1={goalY} y2={goalY} className={styles.chartGoalLine} />
        <text x={width - px} y={goalY - 7} textAnchor="end" className={styles.chartGoalText}>meta {TSI_META.toFixed(1)}</text>
        <path d={area} fill="url(#tsiDetailArea)" />
        <path d={path} className={styles.chartLine} />
        {coords.map((point) => <circle key={point.key} cx={point.x} cy={point.y} r="4" className={styles.chartPoint}><title>{point.label}: {point.score.toFixed(1)}%</title></circle>)}
        {coords.map((point) => <text key={`${point.key}-label`} x={point.x} y={height - 14} textAnchor="middle" className={styles.chartAxisText}>{point.label}</text>)}
      </svg>
    </div>
  )
}

function StoreBars({ stores }: { stores: StoreMetric[] }) {
  if (!stores.length) return <div className={styles.noData}>Sem lojas no período selecionado.</div>
  return (
    <div className={styles.storeBars}>
      {stores.slice(0, 6).map((store) => (
        <div key={store.name} data-tone={toneForScore(store.score)}>
          <header><span title={store.name}>{store.name}</span><strong>{store.score.toFixed(1)}%</strong></header>
          <div><i style={{ width: `${Math.max(2, store.score)}%` }} /></div>
          <small>{store.responses} {store.responses === 1 ? 'resposta' : 'respostas'}</small>
        </div>
      ))}
    </div>
  )
}

function RacChart({ months }: { months: MonthMetric[] }) {
  if (!months.length) return <div className={styles.noData}>Nenhum RAC disponível para o período.</div>
  const max = Math.max(1, ...months.map((month) => month.feedbacks))
  return (
    <div className={styles.racChart} role="img" aria-label="RACs TSI por mês">
      <div className={styles.racGrid} aria-hidden="true" />
      <div className={styles.racBars}>
        {months.map((month) => (
          <div className={styles.racItem} key={month.key}>
            <span>{month.feedbacks}</span>
            <div><i style={{ height: `${month.feedbacks ? Math.max(8, (month.feedbacks / max) * 100) : 3}%` }} /></div>
            <strong>{month.label}</strong>
            <small>{month.responses} respostas</small>
          </div>
        ))}
      </div>
    </div>
  )
}
