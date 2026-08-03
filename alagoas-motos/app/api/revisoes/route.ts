import { NextResponse } from 'next/server'
import { buildRevisoesPayload } from '@/lib/revisoes-db'

// Endpoint PÚBLICO (sem login) com o estado atual dos valores e mercadorias.
// URL: /api/revisoes
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const payload = await buildRevisoesPayload()
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Access-Control-Allow-Origin': '*',
      },
    })
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
