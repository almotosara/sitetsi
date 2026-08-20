import type { Metadata } from 'next'

import { LoginForm } from '@/components/auth/login-form'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Acesso',
  description: 'Acesso restrito ao painel operacional da Alagoas Motos.',
}

function HeroPicture({ backdrop = false }: { backdrop?: boolean }) {
  if (backdrop) {
    return (
      <picture className="login-hero-backdrop" aria-hidden="true">
        <img
          src="/sahara-hero-blur.webp"
          width={960}
          height={350}
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    )
  }

  return (
    <picture>
      <source media="(max-width: 640px)" srcSet="/sahara-hero-960.webp" />
      <source media="(max-width: 1280px)" srcSet="/sahara-hero-1440.webp" />
      <img
        src="/sahara-hero-1920.webp"
        width={1920}
        height={700}
        alt="Honda Sahara 300 em estrada litorânea"
        fetchPriority="high"
        decoding="async"
        className="login-hero-art max-w-none"
      />
    </picture>
  )
}

export default function LoginPage() {
  return (
    <main className="login-shell relative min-h-screen w-full overflow-hidden bg-[#0b0f12] font-manrope">
      <HeroPicture backdrop />
      <HeroPicture />

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,14,0.15)_0%,transparent_35%,transparent_58%,rgba(8,12,14,0.6)_74%,rgba(8,12,14,0.9)_90%)]" />
      <div className="absolute inset-0 bg-black/35 md:bg-transparent" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 md:justify-end md:px-10 lg:px-16">
        <section className="login-card liquid-glass relative isolate flex w-full max-w-md flex-col gap-6 py-7" aria-labelledby="login-title">
          <span aria-hidden="true" className="liquid-glass-sheen" />

          <header className="relative grid auto-rows-min items-start gap-1.5 px-7 text-center">
            <img
              src="/alagoas-motos-logo.webp"
              width={384}
              height={153}
              alt="Alagoas Motos"
              className="login-brand-logo"
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-on-media-muted">
              Analytics · Oficina · TSI
            </p>
            <h1 id="login-title" className="mt-2 text-[clamp(1.55rem,5vw,2rem)] font-semibold leading-none tracking-[-0.04em] text-on-media">
              Bem-vindo de volta
            </h1>
            <p className="mt-1 text-sm text-on-media-muted">
              Acesse o painel operacional da Alagoas Motos.
            </p>
          </header>

          <div className="relative px-7">
            <LoginForm />
          </div>

          <footer className="relative flex flex-col gap-3 px-7">
            <p className="text-center text-xs leading-relaxed text-on-media-muted">
              Acesso restrito à equipe Alagoas Motos.
              <br />
              Seus dados ficam salvos com segurança na nuvem.
            </p>
          </footer>
        </section>
      </div>
    </main>
  )
}
