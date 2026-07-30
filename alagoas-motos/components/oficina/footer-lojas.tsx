"use client";

const LOJAS = [
  {
    nome: "Loja Arapiraca",
    razao: "Alagoas Comércio de Motocicletas Ltda",
    cnpj: "21.821.278/0001-08",
  },
  {
    nome: "Loja Maceió",
    razao: "Alagoas Comércio de Motocicletas Ltda",
    cnpj: "21.821.278/0003-61",
  },
  {
    nome: "Loja União dos Palmares",
    razao: "Alagoas Comércio de Motocicletas Ltda",
    cnpj: "21.821.278/0004-42",
  },
];

export function FooterLojas() {
  return (
    <footer
      className="mt-12 rounded-3xl overflow-hidden animate-oficina-fade"
      style={{
        background: "color-mix(in oklab, var(--bg-panel-2) 78%, transparent)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid var(--border-line-soft)",
        fontFamily: "var(--font-poppins), Poppins, sans-serif",
      }}
    >
      <div className="grid gap-8 px-7 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {LOJAS.map((l, i) => (
          <div
            key={l.cnpj}
            className="min-w-0 animate-oficina-rise"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text-muted)" }}
            >
              {l.nome}
            </div>
            <div
              className="mt-2 text-[13px] font-medium leading-relaxed"
              style={{ color: "var(--text-dim)" }}
            >
              {l.razao}
            </div>
            <div
              className="mt-1 font-mono text-[12.5px] tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {l.cnpj}
            </div>
          </div>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-3 px-7 py-4 text-[11.5px]"
        style={{
          borderTop: "1px solid var(--border-line-soft)",
          background: "color-mix(in oklab, var(--bg-elevated) 55%, transparent)",
          color: "var(--text-muted)",
        }}
      >
        <span>© {new Date().getFullYear()} Alagoas Motos · Uso interno da oficina</span>
        <span className="font-medium">Paz no trânsito começa por você.</span>
      </div>
    </footer>
  );
}
