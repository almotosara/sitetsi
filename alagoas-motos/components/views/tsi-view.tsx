'use client'

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  Gauge,
  MessageSquareText,
  Search,
  Store,
  Target,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'

import { ShinyButton } from '@/components/ui/shiny-button'
import { TSI_CATS, TSI_META, TSI_META_PESQ, TSI_STORE_MAP, TSI_YELLOW } from '@/lib/constants'
import type { TsiRow } from '@/lib/types'

import styles from './tsi-dashboard.module.css'

interface TsiViewProps {
  tsiData: TsiRow[]
  tsiUpdatedAt: string | null
  onImport: () => void
}

type Period = 'all' | '30' | '90'
type MonitorMode = 'below100' | 'belowGoal'
type Tone = 'red' | 'amber' | 'lime' | 'green'

interface StoreMetric {
  name: string
  count: number
  t2bSum: number
  tsiSum: number
  avgT2B: number
  avgTsi: number
  missing: number
}

interface CellMetric {
  count: number
  t2bSum: number
}

interface TrendPoint {
  key: string
  label: string
  value: number
  count: number
}

const score = (value: number | null | undefined) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
}

const storeName = (value: string | null) => {
  if (!value) return 'Não informado'
  return TSI_STORE_MAP[value] || value
}

const shortStoreName = (value: string) => {
  if (value.length <= 12) return value
  return value.split(/\s+/).map((part) => part[0]).join('').slice(0, 6).toUpperCase()
}

function parseDate(value: string | null) {
  if (!value) return null
  const raw = value.trim().split(' ')[0]
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const date = br
    ? new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]))
    : iso
      ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
      : new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function compactDate(value: Date) {
  return value.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'Aguardando primeira importação'
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return `Atualizado em ${date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')}`
  }
  return `Atualizado em ${value}`
}

function toneFor(value: number): Tone {
  if (value >= TSI_META) return 'green'
  if (value >= TSI_YELLOW) return 'amber'
  return 'red'
}

function statusFor(value: number) {
  if (value >= TSI_META) return { label: 'Meta atingida', tone: 'green' as Tone }
  if (value >= TSI_YELLOW) return { label: 'Atenção', tone: 'amber' as Tone }
  return { label: 'Crítico', tone: 'red' as Tone }
}

function buildTrend(rows: TsiRow[]): TrendPoint[] {
  const groups = new Map<string, { date: Date; sum: number; count: number }>()

  rows.forEach((row) => {
    const parsed = parseDate(row.data)
    if (!parsed) return
    const key = dateKey(parsed)
    const current = groups.get(key) || { date: parsed, sum: 0, count: 0 }
    current.sum += score(row.t2b)
    current.count += 1
    groups.set(key, current)
  })

  const dated = Array.from(groups.entries())
    .sort(([, a], [, b]) => a.date.getTime() - b.date.getTime())
    .slice(-12)
    .map(([key, group]) => ({
      key,
      label: compactDate(group.date),
      value: group.count ? group.sum / group.count : 0,
      count: group.count,
    }))

  if (dated.length) return dated

  return rows.slice(-12).map((row, index) => ({
    key: row.id,
    label: row.os ? `OS ${row.os.slice(-4)}` : `#${index + 1}`,
    value: score(row.t2b),
    count: 1,
  }))
}

function aggregate(rows: TsiRow[]) {
  let t2bSum = 0
  let tsiSum = 0
  let goalCount = 0
  let attentionCount = 0
  let criticalCount = 0

  const stores = new Map<string, Omit<StoreMetric, 'avgT2B' | 'avgTsi' | 'missing'>>()
  const matrix = new Map<string, Record<string, CellMetric>>()
  const categories = new Map<string, CellMetric>()
  const feedbacks: TsiRow[] = []
  const alerts: TsiRow[] = []

  rows.forEach((row) => {
    const t2b = score(row.t2b)
    const tsi = score(row.tsi)
    const loja = storeName(row.loja)
    const category = row.cilindrada || 'Não informado'

    t2bSum += t2b
    tsiSum += tsi

    if (t2b >= TSI_META) goalCount += 1
    else if (t2b >= TSI_YELLOW) attentionCount += 1
    else criticalCount += 1

    if (t2b < 100) alerts.push(row)
    if (row.comentario && row.comentario.trim() && row.comentario !== 'NaN') feedbacks.push(row)

    const currentStore = stores.get(loja) || { name: loja, count: 0, t2bSum: 0, tsiSum: 0 }
    currentStore.count += 1
    currentStore.t2bSum += t2b
    currentStore.tsiSum += tsi
    stores.set(loja, currentStore)

    if (!matrix.has(loja)) {
      matrix.set(loja, Object.fromEntries(TSI_CATS.map((item) => [item, { count: 0, t2bSum: 0 }])))
    }
    if (TSI_CATS.includes(category)) {
      const cell = matrix.get(loja)![category]
      cell.count += 1
      cell.t2bSum += t2b
    }

    const categoryMetric = categories.get(category) || { count: 0, t2bSum: 0 }
    categoryMetric.count += 1
    categoryMetric.t2bSum += t2b
    categories.set(category, categoryMetric)
  })

  const storeMetrics: StoreMetric[] = Array.from(stores.values()).map((item) => {
    const avgT2B = item.count ? item.t2bSum / item.count : 0
    const avgTsi = item.count ? item.tsiSum / item.count : 0
    const missing = avgT2B >= TSI_META
      ? 0
      : Math.max(1, Math.ceil((TSI_META * item.count - item.t2bSum) / (100 - TSI_META)))
    return { ...item, avgT2B, avgTsi, missing }
  }).sort((a, b) => b.avgT2B - a.avgT2B)

  const bestCategory = Array.from(categories.entries())
    .filter(([, item]) => item.count > 0)
    .map(([name, item]) => ({ name, count: item.count, avg: item.t2bSum / item.count }))
    .sort((a, b) => b.avg - a.avg)[0] || null

  alerts.sort((a, b) => score(a.t2b) - score(b.t2b))

  return {
    total: rows.length,
    avgT2B: rows.length ? t2bSum / rows.length : 0,
    avgTsi: rows.length ? tsiSum / rows.length : 0,
    goalCount,
    attentionCount,
    criticalCount,
    goalPercent: rows.length ? (goalCount / rows.length) * 100 : 0,
    stores: storeMetrics,
    matrix,
    feedbacks: feedbacks.slice().reverse(),
    alerts,
    bestCategory,
    trend: buildTrend(rows),
  }
}

export function TsiView({ tsiData, tsiUpdatedAt, onImport }: TsiViewProps) {
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const [monitorMode, setMonitorMode] = useState<MonitorMode>('below100')
  const monitoringRef = useRef<HTMLElement | null>(null)

  const filteredData = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    const cutoff = period === 'all'
      ? null
      : new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000)

    return tsiData.filter((row) => {
      if (cutoff) {
        const parsed = parseDate(row.data)
        if (!parsed || parsed < cutoff) return false
      }

      if (!normalized) return true
      return [row.os, storeName(row.loja), row.cilindrada, row.tipo, row.comentario]
        .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(normalized))
    })
  }, [period, query, tsiData])

  const metrics = useMemo(() => aggregate(filteredData), [filteredData])
  const monitorRows = useMemo(() => metrics.alerts.filter((row) => (
    monitorMode === 'belowGoal' ? score(row.t2b) < TSI_META : score(row.t2b) < 100
  )).slice(0, 10), [metrics.alerts, monitorMode])

  const clearFilters = () => {
    setQuery('')
    setPeriod('all')
  }

  return (
    <section className={`${styles.dashboard} view-enter`} aria-label="Dashboard TSI de leads">
      <div className={styles.toolbar}>
        <div className={styles.syncStatus}>
          <span className={styles.liveDot} aria-hidden="true" />
          <div>
            <strong>Inteligência de leads</strong>
            <span>{formatUpdatedAt(tsiUpdatedAt)}</span>
          </div>
        </div>

        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <span className={styles.srOnly}>Buscar nas pesquisas TSI</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar OS, loja ou feedback"
          />
        </label>

        <label className={styles.periodSelect}>
          <span className={styles.srOnly}>Selecionar período</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            <option value="all">Todo período</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </label>

        <ShinyButton onClick={onImport} size="compact" className={styles.importButton}>
          <Upload size={16} aria-hidden="true" />
          Importar TSI
        </ShinyButton>
      </div>

      {tsiData.length === 0 ? (
        <EmptyState onImport={onImport} />
      ) : filteredData.length === 0 ? (
        <div className={styles.emptyFiltered}>
          <Search size={28} aria-hidden="true" />
          <strong>Nenhuma pesquisa encontrada</strong>
          <p>A busca ou o período selecionado não retornou resultados.</p>
          <button type="button" onClick={clearFilters}>Limpar filtros</button>
        </div>
      ) : (
        <>
          <div className={styles.kpiGrid} aria-label="Indicadores principais">
            <KpiCard
              icon={<Users size={18} />}
              tone="red"
              label="Pesquisas de leads"
              value={metrics.total.toLocaleString('pt-BR')}
              note={`${metrics.stores.length} ${metrics.stores.length === 1 ? 'loja monitorada' : 'lojas monitoradas'}`}
            />
            <KpiCard
              icon={<Target size={18} />}
              tone={toneFor(metrics.avgT2B)}
              label="Índice Top2Box"
              value={`${metrics.avgT2B.toFixed(1)}%`}
              note={`Meta operacional: ${TSI_META.toFixed(1)}%`}
            />
            <KpiCard
              icon={<Gauge size={18} />}
              tone="lime"
              label="Satisfação TSI"
              value={metrics.avgTsi.toFixed(1)}
              note="Média das respostas importadas"
            />
            <button
              type="button"
              className={styles.goalCard}
              onClick={() => monitoringRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              aria-label="Ir para pesquisas em acompanhamento"
            >
              <span className={styles.goalIcon}><CheckCircle2 size={18} /></span>
              <span className={styles.goalLabel}>Dentro da meta</span>
              <strong>{metrics.goalCount}</strong>
              <span>{metrics.goalPercent.toFixed(0)}% da base</span>
            </button>
          </div>

          <div className={styles.mainGrid}>
            <Panel
              className={styles.performancePanel}
              title="Performance por loja"
              subtitle="Top2Box médio por unidade"
              icon={<BarChart3 size={18} />}
              action={<span className={styles.metaLegend}><i /> Meta {TSI_META.toFixed(1)}%</span>}
            >
              <div className={styles.metricStrip}>
                <MiniMetric tone="red" label="Base analisada" value={`${metrics.total} pesquisas`} />
                <MiniMetric tone="amber" label="Em atenção" value={`${metrics.attentionCount} respostas`} />
                <MiniMetric tone="green" label="Meta atingida" value={`${metrics.goalCount} respostas`} />
              </div>
              <PerformanceBars stores={metrics.stores} />
            </Panel>

            <Panel
              className={styles.qualityPanel}
              title="Qualidade da base"
              subtitle="Distribuição dos leads pesquisados"
              icon={<Target size={18} />}
            >
              <QualityDonut
                total={metrics.total}
                goal={metrics.goalCount}
                attention={metrics.attentionCount}
                critical={metrics.criticalCount}
              />
            </Panel>

            <Panel
              className={styles.storePanel}
              title="Status das lojas"
              subtitle="Ranking operacional"
              icon={<Store size={18} />}
            >
              <div className={styles.storeList}>
                {metrics.stores.slice(0, 5).map((item, index) => (
                  <StoreStatus key={item.name} item={item} position={index + 1} />
                ))}
              </div>

              {metrics.bestCategory && (
                <div className={styles.bestSegment}>
                  <span><TrendingUp size={16} /> Melhor segmento</span>
                  <strong>{metrics.bestCategory.name}</strong>
                  <small>{metrics.bestCategory.avg.toFixed(1)}% · {metrics.bestCategory.count} pesquisas</small>
                </div>
              )}
            </Panel>
          </div>

          <div className={styles.secondaryGrid}>
            <Panel
              title="Jornada de satisfação"
              subtitle="Evolução do Top2Box no período"
              icon={<TrendingUp size={18} />}
            >
              <TrendChart points={metrics.trend} />
            </Panel>

            <Panel
              className={styles.monitorPanel}
              title="Leads em acompanhamento"
              subtitle="Pesquisas que exigem atenção"
              icon={<AlertTriangle size={18} />}
              action={(
                <label className={styles.compactFilter}>
                  <Filter size={14} aria-hidden="true" />
                  <span className={styles.srOnly}>Filtrar pesquisas em acompanhamento</span>
                  <select value={monitorMode} onChange={(event) => setMonitorMode(event.target.value as MonitorMode)}>
                    <option value="below100">Abaixo de 100</option>
                    <option value="belowGoal">Abaixo da meta</option>
                  </select>
                </label>
              )}
            >
              <MonitorTable rows={monitorRows} />
            </Panel>
          </div>

          <section ref={monitoringRef} className={styles.detailGrid}>
            <Panel
              title="Matriz de oportunidades"
              subtitle="Lojas x faixa de cilindrada"
              icon={<ClipboardCheck size={18} />}
            >
              <MatrixTable stores={metrics.stores} matrix={metrics.matrix} />
            </Panel>

            <Panel
              title="Voz do cliente"
              subtitle="Feedbacks e elogios recentes"
              icon={<MessageSquareText size={18} />}
              action={<span className={styles.feedbackCount}>{metrics.feedbacks.length} comentários</span>}
            >
              <FeedbackList rows={metrics.feedbacks.slice(0, 6)} />
            </Panel>
          </section>
        </>
      )}
    </section>
  )
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}><Upload size={28} /></span>
      <strong>Importe a primeira base TSI</strong>
      <p>A dashboard será preenchida automaticamente com os indicadores de leads, lojas, satisfação e feedbacks.</p>
      <ShinyButton onClick={onImport} size="default">
        <Upload size={17} /> Selecionar planilha
      </ShinyButton>
      <small>Meta Top2Box: {TSI_META.toFixed(1)}% · Meta por loja: {TSI_META_PESQ} pesquisas</small>
    </div>
  )
}

function KpiCard({ icon, tone, label, value, note }: {
  icon: ReactNode
  tone: Tone
  label: string
  value: string
  note: string
}) {
  return (
    <article className={styles.kpiCard} data-tone={tone}>
      <span className={styles.kpiIcon}>{icon}</span>
      <div>
        <span className={styles.kpiLabel}>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  )
}

function Panel({ title, subtitle, icon, action, className = '', children }: {
  title: string
  subtitle: string
  icon: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <article className={`${styles.panel} ${className}`}>
      <header className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span>{icon}</span>
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
        </div>
        {action && <div className={styles.panelAction}>{action}</div>}
      </header>
      {children}
    </article>
  )
}

function MiniMetric({ tone, label, value }: { tone: Tone; label: string; value: string }) {
  return (
    <div className={styles.miniMetric} data-tone={tone}>
      <span><i />{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PerformanceBars({ stores }: { stores: StoreMetric[] }) {
  const visible = stores.slice(0, 10)

  return (
    <div className={styles.barViewport} role="img" aria-label="Gráfico Top2Box médio por loja">
      <div className={styles.chartGrid} aria-hidden="true" />
      <div className={styles.thresholdLine} style={{ top: `${100 - TSI_META}%` }} aria-hidden="true">
        <span>{TSI_META.toFixed(1)}</span>
      </div>
      <div className={styles.bars}>
        {visible.map((item) => {
          const tone = toneFor(item.avgT2B)
          return (
            <div className={styles.barItem} key={item.name} title={`${item.name}: ${item.avgT2B.toFixed(1)}%`}>
              <span className={styles.barValue}>{item.avgT2B.toFixed(1)}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  data-tone={tone}
                  style={{ height: `${Math.max(4, item.avgT2B)}%` }}
                />
              </div>
              <span className={styles.barLabel}>{shortStoreName(item.name)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QualityDonut({ total, goal, attention, critical }: {
  total: number
  goal: number
  attention: number
  critical: number
}) {
  const goalPercent = total ? (goal / total) * 100 : 0
  const attentionPercent = total ? (attention / total) * 100 : 0
  const criticalPercent = total ? (critical / total) * 100 : 0
  const firstStop = criticalPercent
  const secondStop = criticalPercent + attentionPercent

  return (
    <div className={styles.donutWrap}>
      <div
        className={styles.donut}
        style={{
          background: `conic-gradient(#ef4444 0 ${firstStop}%, #ffb739 ${firstStop}% ${secondStop}%, #3bd69b ${secondStop}% 100%)`,
        }}
        role="img"
        aria-label={`${goal} dentro da meta, ${attention} em atenção e ${critical} críticos`}
      >
        <div>
          <span>Dentro da meta</span>
          <strong>{goalPercent.toFixed(0)}%</strong>
          <small>{goal} de {total}</small>
        </div>
      </div>
      <div className={styles.donutLegend}>
        <LegendRow tone="green" label="Meta atingida" value={goal} />
        <LegendRow tone="amber" label="Atenção" value={attention} />
        <LegendRow tone="red" label="Crítico" value={critical} />
      </div>
    </div>
  )
}

function LegendRow({ tone, label, value }: { tone: Tone; label: string; value: number }) {
  return (
    <div data-tone={tone}>
      <span><i />{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StoreStatus({ item, position }: { item: StoreMetric; position: number }) {
  const status = statusFor(item.avgT2B)
  const progressStyle = { '--progress': `${item.avgT2B}%` } as CSSProperties

  return (
    <div className={styles.storeStatus}>
      <div className={styles.storeRank}>{String(position).padStart(2, '0')}</div>
      <div className={styles.storeInfo}>
        <div>
          <strong title={item.name}>{item.name}</strong>
          <span className={styles.statusBadge} data-tone={status.tone}>{status.label}</span>
        </div>
        <div className={styles.progressTrack} style={progressStyle} data-tone={status.tone}>
          <i />
        </div>
        <small>{item.count} pesquisas · TSI {item.avgTsi.toFixed(1)}{item.missing ? ` · faltam +${item.missing} notas 100` : ''}</small>
      </div>
      <b>{item.avgT2B.toFixed(1)}</b>
    </div>
  )
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (!points.length) {
    return <div className={styles.noData}>Sem datas suficientes para montar a evolução.</div>
  }

  const width = 660
  const height = 230
  const paddingX = 28
  const paddingTop = 24
  const paddingBottom = 38
  const values = points.map((item) => item.value)
  const floor = Math.max(0, Math.min(88, Math.floor(Math.min(...values, TSI_META) - 4)))
  const ceiling = 100
  const plotHeight = height - paddingTop - paddingBottom
  const plotWidth = width - paddingX * 2
  const x = (index: number) => paddingX + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
  const y = (value: number) => paddingTop + (1 - (value - floor) / Math.max(1, ceiling - floor)) * plotHeight
  const coordinates = points.map((item, index) => ({ ...item, x: x(index), y: y(item.value) }))
  const linePath = coordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L ${coordinates.at(-1)!.x} ${height - paddingBottom} L ${coordinates[0].x} ${height - paddingBottom} Z`
  const metaY = y(TSI_META)
  const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]))

  return (
    <div className={styles.trendChart} role="img" aria-label="Evolução do Top2Box no período selecionado">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="tsiTrendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f04449" stopOpacity=".34" />
            <stop offset="100%" stopColor="#f04449" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((item) => {
          const gridY = paddingTop + (plotHeight / 3) * item
          return <line key={item} x1={paddingX} y1={gridY} x2={width - paddingX} y2={gridY} className={styles.gridLine} />
        })}
        <line x1={paddingX} y1={metaY} x2={width - paddingX} y2={metaY} className={styles.metaLine} />
        <text x={width - paddingX} y={metaY - 7} textAnchor="end" className={styles.metaText}>meta {TSI_META.toFixed(1)}</text>
        <path d={areaPath} fill="url(#tsiTrendArea)" />
        <path d={linePath} className={styles.trendLine} />
        {coordinates.map((point) => (
          <circle key={point.key} cx={point.x} cy={point.y} r="4" className={styles.trendPoint}>
            <title>{point.label}: {point.value.toFixed(1)}% ({point.count} pesquisas)</title>
          </circle>
        ))}
        {labelIndexes.map((index) => (
          <text key={points[index].key} x={coordinates[index].x} y={height - 11} textAnchor="middle" className={styles.axisText}>
            {points[index].label}
          </text>
        ))}
      </svg>
      <div className={styles.trendSummary}>
        <span>Mínimo <b>{Math.min(...values).toFixed(1)}</b></span>
        <span>Média <b>{(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}</b></span>
        <span>Máximo <b>{Math.max(...values).toFixed(1)}</b></span>
      </div>
    </div>
  )
}

function MonitorTable({ rows }: { rows: TsiRow[] }) {
  if (!rows.length) {
    return (
      <div className={styles.healthyState}>
        <CheckCircle2 size={24} />
        <span>Nenhuma pesquisa neste filtro.</span>
      </div>
    )
  }

  return (
    <div className={styles.tableViewport}>
      <table className={styles.monitorTable}>
        <thead>
          <tr>
            <th>O.S.</th>
            <th>Loja</th>
            <th>Segmento</th>
            <th>Top2Box</th>
            <th>TSI</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const t2b = score(row.t2b)
            const status = statusFor(t2b)
            return (
              <tr key={row.id}>
                <td data-label="O.S."><strong>#{row.os || '—'}</strong></td>
                <td data-label="Loja">{storeName(row.loja)}</td>
                <td data-label="Segmento">{row.cilindrada || '—'}</td>
                <td data-label="Top2Box"><b data-tone={status.tone}>{t2b.toFixed(1)}</b></td>
                <td data-label="TSI">{score(row.tsi).toFixed(1)}</td>
                <td data-label="Situação"><span className={styles.statusBadge} data-tone={status.tone}>{status.label}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MatrixTable({ stores, matrix }: { stores: StoreMetric[]; matrix: Map<string, Record<string, CellMetric>> }) {
  if (!stores.length) return <div className={styles.noData}>Nenhuma loja disponível no período.</div>

  return (
    <div className={styles.matrixViewport}>
      <table className={styles.matrixTable}>
        <thead>
          <tr>
            <th>Loja</th>
            {TSI_CATS.map((category) => <th key={category}>{category}</th>)}
          </tr>
        </thead>
        <tbody>
          {stores.map((storeMetric) => (
            <tr key={storeMetric.name}>
              <td><strong>{storeMetric.name}</strong><small>{storeMetric.count} pesquisas</small></td>
              {TSI_CATS.map((category) => {
                const cell = matrix.get(storeMetric.name)?.[category]
                const average = cell?.count ? cell.t2bSum / cell.count : null
                const tone = average == null ? undefined : toneFor(average)
                return (
                  <td key={category}>
                    {average == null ? (
                      <span className={styles.mutedValue}>—</span>
                    ) : (
                      <span className={styles.matrixScore} data-tone={tone}>
                        <b>{average.toFixed(1)}</b>
                        <small>{cell!.count} respostas</small>
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FeedbackList({ rows }: { rows: TsiRow[] }) {
  if (!rows.length) {
    return <div className={styles.noData}>Nenhum comentário registrado nas pesquisas deste período.</div>
  }

  return (
    <div className={styles.feedbackGrid}>
      {rows.map((row) => {
        const isPraise = row.tipo?.toLocaleLowerCase('pt-BR').includes('elogio')
        return (
          <article className={styles.feedbackCard} key={row.id}>
            <header>
              <span data-tone={isPraise ? 'green' : 'red'}>{isPraise ? 'Elogio' : row.tipo || 'Feedback'}</span>
              <small>OS #{row.os}</small>
            </header>
            <p>“{row.comentario}”</p>
            <footer>
              <strong>{storeName(row.loja)}</strong>
              <span>{row.data || 'Data não informada'}</span>
            </footer>
          </article>
        )
      })}
    </div>
  )
}
