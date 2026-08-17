import Image from 'next/image'
import { carregarAgendamentosTv, dataLocalHoje } from '@/lib/agendamentos-db'
import type { AgendamentosTvPayload } from '@/lib/agendamentos'
import { podeVerTv } from '@/lib/tv-auth'
import { TvAgendamentos } from '@/components/agendamentos/tv-agendamentos'
import styles from './tv.module.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEMO: AgendamentosTvPayload = {
  data: dataLocalHoje(),
  sincronizado_em: new Date().toISOString(),
  agendamentos: [
    { id: '1', empresa: 'ARA', numero_agendamento: '180201', data_agendamento: dataLocalHoje(), hora_agendamento: '08:00:00', situacao: 'OS', tipo_os: 'REVISÃO PERIÓDICA', placa_exibicao: 'QWE-••••', modelo: 'CG 160 FAN', nome_exibicao: 'Marcos S.', consultor: 'MACIEL ALVES', sincronizado_em: new Date().toISOString() },
    { id: '2', empresa: 'ARA', numero_agendamento: '180202', data_agendamento: dataLocalHoje(), hora_agendamento: '09:30:00', situacao: 'OS', tipo_os: '1ª REVISÃO GRATUITA', placa_exibicao: 'RTY-••••', modelo: 'NXR 160 BROS ABS', nome_exibicao: 'Ana C.', consultor: 'KAWANNY SILVA', sincronizado_em: new Date().toISOString() },
    { id: '3', empresa: 'ARA', numero_agendamento: '180203', data_agendamento: dataLocalHoje(), hora_agendamento: '11:30:00', situacao: 'Agendado', tipo_os: 'DIAGNÓSTICO', placa_exibicao: 'TNK-••••', modelo: 'XRE 190 ABS', nome_exibicao: 'João A.', consultor: 'JANIELLE MARIA', sincronizado_em: new Date().toISOString() },
    { id: '4', empresa: 'ARA', numero_agendamento: '180204', data_agendamento: dataLocalHoje(), hora_agendamento: '13:30:00', situacao: 'Confirmado', tipo_os: 'REVISÃO PERIÓDICA', placa_exibicao: 'TNJ-••••', modelo: 'CG 160 TITAN', nome_exibicao: 'Larissa M.', consultor: 'MACIEL ALVES', sincronizado_em: new Date().toISOString() },
    { id: '5', empresa: 'ARA', numero_agendamento: '180205', data_agendamento: dataLocalHoje(), hora_agendamento: '15:00:00', situacao: 'Agendado', tipo_os: 'EXTERNO', placa_exibicao: 'SAA-••••', modelo: 'PCX 160 ABS', nome_exibicao: 'Rafael B.', consultor: 'KAWANNY SILVA', sincronizado_em: new Date().toISOString() },
    { id: '6', empresa: 'ARA', numero_agendamento: '180206', data_agendamento: dataLocalHoje(), hora_agendamento: '17:30:00', situacao: 'Agendado', tipo_os: '2ª REVISÃO GRATUITA', placa_exibicao: 'TNP-••••', modelo: 'NXR 160 BROS ABS', nome_exibicao: 'André P.', consultor: 'MACIEL ALVES', sincronizado_em: new Date().toISOString() },
  ],
}

export default async function TvAgendamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const demo = process.env.NODE_ENV !== 'production' && params.demo === '1'
  const autorizado = demo || await podeVerTv()

  if (!autorizado) {
    return (
      <main className={styles.blocked}>
        <div className={styles.blockedCard}>
          <Image src="/alagoas-motos-logo.png" width={223} height={42} alt="Alagoas Motos" priority />
          <div className={styles.blockedIcon}>TV</div>
          <h1>Acesso da recepção não configurado</h1>
          <p>Abra nesta TV o link de ativação fornecido pelo responsável do painel. A ativação fica salva neste aparelho.</p>
          {params.erro === 'acesso' && <span>A chave informada não é válida.</span>}
        </div>
      </main>
    )
  }

  let inicial = DEMO
  if (!demo) {
    try {
      inicial = await carregarAgendamentosTv()
    } catch (erro) {
      console.error('[tv/agendamentos]', erro)
      inicial = { data: dataLocalHoje(), agendamentos: [], sincronizado_em: null }
    }
  }

  return <TvAgendamentos inicial={inicial} demo={demo} />
}
