export const TSI_META = 93.5
export const TSI_YELLOW = 92.0
export const TSI_META_PESQ = 15

export const TSI_STORE_MAP: Record<string, string> = {
  'PAVS-PERNAMBUCO PAUDALHO': 'Paudalho',
  'PDF-PERNAMBUCO MOTOS': 'Boa Viagem',
  'PAVS-PERNAMBUCO JABO': 'Jaboatão',
  'PD-PERNAMBUCO GRACAS': 'Graças',
  'PAVS-PERNAMBUCO MOTOS': 'Igarassu',
  'PERNAMBUCO OLINDA': 'Peixinhos',
  'PERNAMBUCO MOTOS': 'Paulista',
  'PERNAMBUCO CAMARAGIB': 'Camaragibe',
  'ALAGOAS MOTOS': 'Alagoas',
}

export const TSI_CATS = ['Alta', 'Média', 'Baixa', 'Scooter']

export const STATUS_OPTIONS = [
  'Novo',
  'Em contato',
  'Proposta enviada',
  'Convertido',
  'Perdido',
] as const

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Novo':              { bg: '#4c8dff26', text: '#4c8dff' },
  'Em contato':        { bg: '#ffc40033', text: '#ffc400' },
  'Proposta enviada':  { bg: '#b083ff26', text: '#b083ff' },
  'Convertido':        { bg: '#2fd67526', text: '#2fd675' },
  'Perdido':           { bg: '#ff5a5f26', text: '#ff5a5f' },
}

export const ORIGEM_COLORS: Record<string, { bg: string; text: string }> = {
  'Bot WhatsApp': { bg: '#b083ff26', text: '#b083ff' },
  'Website':      { bg: '#4c8dff26', text: '#4c8dff' },
  'MicroWork OS': { bg: '#ffc40033', text: '#ffc400' },
}

export function tsiColor(score: number) {
  if (score >= TSI_META) return 'green'
  if (score >= TSI_YELLOW) return 'yellow'
  return 'red'
}

export function tsiPesqColor(count: number) {
  if (count >= TSI_META_PESQ) return 'green'
  if (count >= 12) return 'yellow'
  return 'red'
}

export function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

export function fmtDateTime(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
