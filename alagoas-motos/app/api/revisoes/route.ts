import { NextResponse } from 'next/server'
import { buildRevisoesPayload } from '@/lib/revisoes-db'
import revisoesFallback from '@/public/data/revisoes.json'

// Endpoint PÚBLICO (sem login) com o estado atual dos valores e mercadorias.
// URL: /api/revisoes
export const dynamic = 'force-dynamic'
export const revalidate = 0

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Access-Control-Allow-Origin': '*',
}

function fallbackPayload() {
  return {
    ...revisoesFallback,
    atualizado_em: null,
    servicos_avulsos: [],
    fonte: 'arquivo-local',
  }
}

export async function GET() {
  // Mantém a consulta da oficina funcional em instalações locais e previews
  // antes da configuração do Supabase. Em produção, o banco segue sendo a
  // fonte prioritária e erros reais não são mascarados pelo fallback.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(fallbackPayload(), { headers: responseHeaders })
  }

  try {
    const payload = await buildRevisoesPayload()
    return NextResponse.json(payload, { headers: responseHeaders })
  } catch (e) {
    return NextResponse.json(
      { error: 'Falha ao carregar dados', detalhe: (e as Error).message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
