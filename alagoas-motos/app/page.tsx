import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/toast'
import { ThemeProvider } from '@/components/theme-provider'

// Tenta carregar dados do Supabase se disponível
async function loadData() {
  try {
    const { getLeads, getTsiData, getClientesFieis, getSettings } = await import('@/app/actions')
    const [leads, tsiData, fieis, settings] = await Promise.all([
      getLeads().catch((e) => { console.warn('[Supabase] getLeads falhou:', e.message); return [] }),
      getTsiData().catch((e) => { console.warn('[Supabase] getTsiData falhou:', e.message); return [] }),
      getClientesFieis().catch((e) => { console.warn('[Supabase] getClientesFieis falhou:', e.message); return [] }),
      getSettings().catch((e) => { console.warn('[Supabase] getSettings falhou:', e.message); return null }),
    ])
    return {
      leads: leads || [],
      tsiData: tsiData || [],
      fieis: fieis || [],
      goal: settings?.goal ?? 150,
      tsiUpdatedAt: settings?.tsi_updated_at ?? null,
      displayName: settings?.display_name ?? null,
      avatarUrl: settings?.avatar_url ?? null,
    }
  } catch {
    return { leads: [], tsiData: [], fieis: [], goal: 150, tsiUpdatedAt: null, displayName: null, avatarUrl: null }
  }
}

export default async function Page() {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const { leads, tsiData, fieis, goal, tsiUpdatedAt, displayName, avatarUrl } = await loadData()

  return (
    <ThemeProvider>
      <ToastProvider>
        <AppShell
          userName={session.name}
          userEmail={session.email}
          initialLeads={leads}
          initialTsi={tsiData}
          initialFieis={fieis}
          initialGoal={goal}
          initialTsiUpdatedAt={tsiUpdatedAt}
          initialDisplayName={displayName}
          initialAvatarUrl={avatarUrl}
        />
      </ToastProvider>
    </ThemeProvider>
  )
}