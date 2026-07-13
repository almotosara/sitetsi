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
  importado_em: string
}

export interface ClienteFiel {
  id: string
  user_id: string
  nome: string
  whatsapp: string | null
  criado_em: string
}

export interface ReenvioRow {
  id: string
  user_id?: string
  os: string
  cliente: string
  email: string | null
  celular: string | null
  veiculo: string | null
  dataEnvioEmail: string | null
  dataEnvioSms: string | null
  dataReenvio: string | null
  loja: string | null
  isFiel: boolean
  contatado?: boolean
  contatado_em?: string | null
  contatado_canal?: string | null
  importado_em?: string
}

export interface UserSettings {
  user_id: string
  goal: number
  tsi_updated_at: string | null
  atualizado_em: string
}
