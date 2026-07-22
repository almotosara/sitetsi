'use client'

/**
 * Wrapper novo: renderiza a Dashboard de Ordens de Serviço como tela principal
 * da conta oficina@alagoasmotos.com. Mantém o Manual de Manutenção legado
 * (OficinaManualShell) acessível como aba secundária dentro da própria dashboard.
 *
 * IMPORTANTE: não toca em TSI, AppShell, nem nas tabelas/actions do consultor.
 */

import { OSDashboard } from './os/OSDashboard'
import { OficinaManualShell } from './oficina-manual-shell'

export function OficinaShell({ userName, userEmail }: { userName: string; userEmail: string }) {
  return (
    <OSDashboard
      userName={userName}
      userEmail={userEmail}
      renderManual={() => <OficinaManualShell userName={userName} userEmail={userEmail} />}
    />
  )
}
