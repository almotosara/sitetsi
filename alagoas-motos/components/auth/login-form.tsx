'use client'

import { useState, type FormEvent } from 'react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.error || 'Erro ao fazer login')
        return
      }

      window.location.assign('/')
    } catch {
      setError('Erro de conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-media-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seu@email.com"
          required
          autoComplete="email"
          inputMode="email"
          className="field-glass min-h-12 w-full rounded-xl px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-media-muted">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className="field-glass min-h-12 w-full rounded-xl px-4 py-3 text-sm"
        />
      </div>

      <p className="min-h-5 text-center text-sm text-red-300" role="alert" aria-live="polite">
        {error}
      </p>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="shiny-cta shiny-cta-wide login-primary-button mt-1 w-full text-[15px] font-semibold text-on-media disabled:cursor-not-allowed"
      >
        <span className="shiny-cta-content">
          {loading ? (
            <>
              <span className="login-loading-spinner" aria-hidden="true" />
              Entrando…
            </>
          ) : (
            <>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Entrar
            </>
          )}
        </span>
      </button>
    </form>
  )
}
