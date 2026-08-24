export type LeadStatus = 'Novo' | 'Em contato' | 'Proposta enviada' | 'Convertido' | 'Perdido'
export type LeadOrigem = 'Bot WhatsApp' | 'Website' | 'MicroWork OS'

export interface Lead {
  id: string
  user_id: string
  nome: string
  telefone: string | null
  origem: LeadOrigem
  data: string | null
  os: string | null
  nf: string | null
  modelo: string | null
  cpf: string | null
  email: string | null
  status: LeadStatus
  obs: string | null
  lembrete_em?: string | null
  lembrete_texto?: string | null
  criado_em: string
  atualizado_em: string
}

export interface TsiRow {
  id: string
  user_id: string
  os: string
  loja: string | null
  t2b: number | null
  tsi: number | null
  cilindrada: string | null
  tipo: string | null
  comentario: string | null
  data: string | null
  detalhamento?: TsiBlockRatings | null
  importado_em: string
}

/** Notas brutas (0 a 10) usadas para calcular o Top2Box de cada área.
 * O campo fica em JSONB para acompanhar novas dimensões da pesquisa sem
 * transformar cada ajuste do questionário em uma migração extensa. */
export interface TsiBlockRatings {
  satisfacaoGeral: number | null
  infraestrutura: number | null
  consultor: number | null
  qualidade: number | null
  entrega: number | null
  custoBeneficio: number | null
  recomendacao: number | null
  retornoFuturo: number | null
  agendamento: number | null
  recepcao: number | null
}

export interface ClienteFiel {
  id: string
  user_id: string
  nome: string
  whatsapp: string | null
  criado_em: string
}

export interface TsiResendRow {
  id: string
  user_id: string
  os: string
  cliente: string | null
  veiculo: string | null
  email: string | null
  celular: string | null
  data_envio_email: string | null
  data_envio_sms: string | null
  data_reenvio: string | null
  importado_em: string
}

export interface ReenvioRow extends TsiResendRow {
  contatado: boolean
  contatado_em: string | null
  contatado_canal: string | null
  isFiel: boolean
}

export interface UserSettings {
  user_id: string
  goal: number
  tsi_updated_at: string | null
  atualizado_em: string
}
