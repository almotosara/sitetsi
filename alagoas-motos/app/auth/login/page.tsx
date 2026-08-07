'use client'

import { useState } from 'react'
import { Lock, Loader2 } from 'lucide-react'

import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardFooter,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card'
import { LiquidButton } from '@/components/ui/liquid-glass-button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login')
        return
      }

      window.location.href = '/'
    } catch {
      setError('Erro de conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#0b0f12] font-manrope">
      {/* preenchimento de fundo desfocado (não corta a arte principal) */}
      <img
        src="/sahara-hero.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
      />
      {/* arte principal: moto e textos sempre inteiros, à esquerda */}
      <img
        src="/sahara-hero.webp"
        alt="Honda Sahara 300 em estrada litorânea"
        className="absolute left-[-58%] top-1/2 w-[200%] max-w-none -translate-y-1/2 md:left-[-26%] md:w-[120%] lg:left-[-18%] lg:w-[112%]"
      />

      {/* escurece só o lado direito, preservando a moto e os textos à esquerda */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,14,0.15)_0%,transparent_35%,transparent_58%,rgba(8,12,14,0.6)_74%,rgba(8,12,14,0.9)_90%)]" />
      <div className="absolute inset-0 bg-black/35 md:bg-transparent" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 md:justify-end md:px-10 lg:px-16">
        <GlassCard className="w-full max-w-md">
          <GlassCardHeader className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-on-media-muted">
              Alagoas Motos
            </p>
            <GlassCardTitle className="mt-2 text-2xl text-on-media">
              Leads · Alagoas Motos
            </GlassCardTitle>
            <GlassCardDescription className="mt-1 text-on-media-muted">
              Painel de cadastro e relatório de leads.
            </GlassCardDescription>
          </GlassCardHeader>

          <GlassCardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-media-muted"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className="field-glass w-full rounded-xl px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-media-muted"
                >
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="field-glass w-full rounded-xl px-4 py-3 text-sm"
                />
              </div>

              {error && <p className="text-center text-sm text-red-400">{error}</p>}

              <LiquidButton
                type="submit"
                size="xl"
                disabled={loading}
                className="mt-1 w-full rounded-xl text-[15px] font-semibold text-on-media disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Lock className="h-[18px] w-[18px]" />
                    Entrar
                  </>
                )}
              </LiquidButton>
            </form>
          </GlassCardContent>

          <GlassCardFooter>
            <p className="text-center text-xs leading-relaxed text-on-media-muted">
              Acesso restrito à equipe Alagoas Motos.
              <br />
              Seus dados ficam salvos com segurança na nuvem.
            </p>
          </GlassCardFooter>
        </GlassCard>
      </div>
    </main>
  )
}
