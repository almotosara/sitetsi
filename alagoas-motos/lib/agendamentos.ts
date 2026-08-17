export interface AgendamentoTv {
  id: string
  numero_agendamento: string
  data_agendamento: string
  hora_agendamento: string
  situacao: string
  tipo_os: string | null
  placa_exibicao: string | null
  modelo: string | null
  nome_exibicao: string
  consultor: string | null
  empresa: string
  sincronizado_em: string
}

export interface AgendamentosTvPayload {
  data: string
  agendamentos: AgendamentoTv[]
  sincronizado_em: string | null
}

export interface AgendamentoImportado {
  empresa: string
  numero_agendamento: string
  data_agendamento: string
  hora_agendamento: string
  situacao: string
  tipo_os?: string | null
  placa?: string | null
  modelo?: string | null
  pessoa: string
  telefone?: string | null
  celular?: string | null
  consultor?: string | null
}

export function mascararNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return 'Cliente'
  if (partes.length === 1) return titulo(partes[0])
  return `${titulo(partes[0])} ${partes[partes.length - 1][0].toUpperCase()}.`
}

export function mascararPlaca(placa?: string | null): string | null {
  if (!placa) return null
  const limpa = placa.trim().toUpperCase()
  if (limpa.length < 4) return limpa
  return `${limpa.slice(0, 3)}-••••`
}

function titulo(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase()
}
