import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AdminPanel } from '@/components/admin/admin-panel'
import { ThemeProvider } from '@/components/theme-provider'
import { SiteBackground } from '@/components/ui/site-background'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/auth/login')
  if (session.role !== 'admin') redirect('/')

  return (
    <ThemeProvider>
      <SiteBackground>
        <AdminPanel userEmail={session.email} />
      </SiteBackground>
    </ThemeProvider>
  )
}
