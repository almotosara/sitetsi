'use client'

import { useState } from 'react'
import Image from 'next/image'

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
    <div
      className="min-h-screen flex items-center justify-center transition-colors duration-300"
      style={{
        background: 'radial-gradient(1100px 600px at 85% -10%, #ff4b2b14, transparent 60%), radial-gradient(900px 500px at -10% 110%, #ffc40010, transparent 55%), var(--bg-main, #101215)',
      }}
    >
      <div
        className="w-full max-w-md mx-auto rounded-2xl border p-10 flex flex-col items-center gap-8 transition-colors duration-300"
        style={{
          background: 'var(--bg-panel, #1a1d22)',
          borderColor: 'var(--border-line, #31363d)',
          boxShadow: '0 24px 60px -16px rgba(0,0,0,.7)',
        }}
      >
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/alagoas-motos-removebg-preview-iffjRi9U1BJ8xt500mZrqPuJrzBzos.png"
          alt="Alagoas Motos"
          width={180}
          height={60}
          className="object-contain"
          unoptimized
        />

        <div className="text-center">
          <h1
            className="text-2xl font-bold mb-2 transition-colors duration-300"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              letterSpacing: '0.3px',
              color: 'var(--text-primary, #f2f0ea)',
            }}
          >
            Leads · Alagoas Motos
          </h1>
          <p
            className="text-sm leading-relaxed transition-colors duration-300"
            style={{ color: 'var(--text-muted, #868c94)' }}
          >
            Painel de cadastro e relatório de leads.
          </p>
        </div>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider transition-colors duration-300"
              style={{ color: 'var(--text-muted, #868c94)' }}
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
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[#ff4b2b50]"
              style={{
                background: 'var(--bg-input, #20242a)',
                borderColor: error ? '#ff5a5f' : 'var(--border-line, #31363d)',
                color: 'var(--text-primary, #f2f0ea)',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider transition-colors duration-300"
              style={{ color: 'var(--text-muted, #868c94)' }}
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
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[#ff4b2b50]"
              style={{
                background: 'var(--bg-input, #20242a)',
                borderColor: error ? '#ff5a5f' : 'var(--border-line, #31363d)',
                color: 'var(--text-primary, #f2f0ea)',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-[#ff5a5f] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-white font-semibold text-[15px] py-3.5 px-5 transition-all hover:-translate-y-px cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #ff4b2b, #d63a1e)',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 6px 20px -6px #ff4b2b60',
            }}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Entrar
              </>
            )}
          </button>
        </form>

        <p
          className="text-xs text-center leading-relaxed transition-colors duration-300"
          style={{ color: 'var(--text-muted, #868c94)' }}
        >
          Acesso restrito à equipe Alagoas Motos.<br />
          Seus dados ficam salvos com segurança na nuvem.
        </p>
      </div>
    </div>
  )
}