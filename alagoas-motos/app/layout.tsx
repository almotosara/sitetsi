import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

export const metadata: Metadata = {
  metadataBase: new URL('https://alagoasmotos.netlify.app'),
  applicationName: 'Alagoas Motos',
  title: {
    default: 'Alagoas Motos',
    template: '%s | Alagoas Motos',
  },
  description: 'Painel operacional de leads, pesquisas TSI, oficina e agendamentos da Alagoas Motos.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Alagoas Motos',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f12' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <body className="antialiased font-sans">
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
