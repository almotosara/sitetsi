import type { Metadata, Viewport } from 'next'
import { Rajdhani, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-rajdhani',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Leads · Alagoas Motos',
  description: 'Painel de cadastro e relatório de leads — Alagoas Motos',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-light-32x32.png', sizes: '32x32', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', sizes: '32x32', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#f5f6f2',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${rajdhani.variable} ${jetbrainsMono.variable}`} data-theme="light" suppressHydrationWarning>
      <body className="antialiased font-sans" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}