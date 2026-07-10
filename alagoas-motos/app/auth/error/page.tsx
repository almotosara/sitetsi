import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101215]">
      <div className="text-center flex flex-col items-center gap-6 max-w-sm px-6">
        <div className="w-14 h-14 rounded-2xl bg-[#ff5a5f26] flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#f2f0ea] mb-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            Erro na autenticação
          </h1>
          <p className="text-[#868c94] text-sm leading-relaxed">
            Ocorreu um problema ao fazer login. Por favor, tente novamente.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff4b2b] text-white font-semibold text-sm hover:brightness-110 transition-all"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  )
}
