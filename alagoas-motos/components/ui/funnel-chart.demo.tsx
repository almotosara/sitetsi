'use client'

import { FunnelChart } from '@/components/ui/funnel-chart'

/**
 * Referência isolada para validar o componente durante o desenvolvimento.
 * Este arquivo não é importado por nenhuma rota e não entra no bundle final.
 */
export default function FunnelChartDemo() {
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <FunnelChart
        data={[
          { label: 'Novo', value: 180, gradient: [{ offset: '0%', color: 'var(--chart-1)' }, { offset: '100%', color: 'var(--chart-2)' }] },
          { label: 'Em contato', value: 126, gradient: [{ offset: '0%', color: 'var(--chart-2)' }, { offset: '100%', color: 'var(--chart-3)' }] },
          { label: 'Proposta enviada', value: 72, gradient: [{ offset: '0%', color: 'var(--chart-3)' }, { offset: '100%', color: 'var(--chart-4)' }] },
          { label: 'Convertido', value: 31, gradient: [{ offset: '0%', color: 'var(--chart-4)' }, { offset: '100%', color: 'var(--chart-5)' }] },
        ]}
        layers={3}
      />
    </div>
  )
}
