import type { Metadata, Viewport } from 'next'
import { Rajdhani, Inter, Poppins, JetBrains_Mono, Manrope } from 'next/font/google'
import './globals.css'
import './consultant.css'
import { AppleLoading } from '@/components/ui/apple-loading'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-rajdhani',
})
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
})
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope-google',
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
    icon: '/alagoas-motos-symbol.png',
    apple: '/alagoas-motos-symbol.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f5f7',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${rajdhani.variable} ${poppins.variable} ${jetbrainsMono.variable} ${manrope.variable}`} data-theme="light" suppressHydrationWarning>
      <body className="antialiased font-sans" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
        <AppleLoading />
        {children}
      </body>
    </html>
  )
}
