import { NextResponse } from 'next/server'
import { carregarAgendamentosTv, dataLocalHoje } from '@/lib/agendamentos-db'
import { podeVerTv } from '@/lib/tv-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  if (!(await podeVerTv())) {
    return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const data = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('data') ?? '')
      ? url.searchParams.get('data')!
      : dataLocalHoje()
    const payload = await carregarAgendamentosTv(data)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (erro) {
    console.error('[agendamentos/tv]', erro)
    return NextResponse.json({ error: 'Falha ao carregar agendamentos' }, { status: 500 })
  }
}
