"use client";

// Calculadora informativa de prazo de garantia das revisões.
// O consultor digita a data de compra da moto e vê, revisão a revisão,
// se ainda está dentro do prazo (meses a partir da compra) ou já venceu.
// Não salva nada: é 100% local (useState) e usa os dados que já vieram do /api/revisoes.

import { useMemo, useState } from "react";
import { nomeCurto } from "../../lib/motos-catalog";
import type { RevisoesData } from "../../lib/revisoes-calc";
import { StatusBadge } from "@/components/ui/status-badge";

const ACCENT = "#d71920";
const FONT = "var(--font-poppins), Poppins, sans-serif";

/** Fallback só usado se os dados não trouxerem `meses` para alguma revisão. */
const PRAZO_PADRAO: Record<number, { km: number; meses: number }> = {
  1: { km: 1000, meses: 3 },
  2: { km: 6000, meses: 6 },
  3: { km: 12000, meses: 12 },
  4: { km: 18000, meses: 18 },
  5: { km: 24000, meses: 24 },
  6: { km: 30000, meses: 30 },
  7: { km: 36000, meses: 36 },
};

interface LinhaPrazo {
  numero: number;
  km: number;
  meses: number;
  limite: Date;
  vencida: boolean;
  estimado: boolean;
}

function addMeses(base: Date, meses: number) {
  const d = new Date(base.getTime());
  const dia = d.getDate();
  d.setMonth(d.getMonth() + meses);
  // Ajuste de virada de mês (ex.: 31/01 + 1 mês → 03/03 vira 28/02)
  if (d.getDate() < dia) d.setDate(0);
  return d;
}

function fmtData(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Moda dos valores de `meses`/`km` por número de revisão em toda a base. */
function prazosDeReferencia(data: RevisoesData) {
  const acc = new Map<number, { km: number[]; meses: number[] }>();
  for (const m of data.modelos) {
    for (const r of m.revisoes) {
      const cur = acc.get(r.numero) ?? { km: [], meses: [] };
      if (r.km) cur.km.push(r.km);
      if (r.meses != null) cur.meses.push(r.meses);
      acc.set(r.numero, cur);
    }
  }
  const moda = (arr: number[]) => {
    const c = new Map<number, number>();
    for (const v of arr) c.set(v, (c.get(v) ?? 0) + 1);
    let best: number | null = null;
    let bestN = 0;
    for (const [v, n] of c) if (n > bestN) { bestN = n; best = v; }
    return best;
  };
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, v]) => ({
      numero,
      km: moda(v.km) ?? PRAZO_PADRAO[numero]?.km ?? 0,
      meses: moda(v.meses) ?? PRAZO_PADRAO[numero]?.meses ?? numero * 6,
    }));
}

export function PrazoRevisaoCard({ data }: { data: RevisoesData }) {
  const [dataCompra, setDataCompra] = useState("");
  const [modeloSel, setModeloSel] = useState("");

  const referencia = useMemo(() => prazosDeReferencia(data), [data]);

  const linhas = useMemo<LinhaPrazo[]>(() => {
    if (!dataCompra) return [];
    const [ano, mes, dia] = dataCompra.split("-").map(Number);
    if (!ano || !mes || !dia) return [];
    const base = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const modelo = data.modelos.find((m) => m.modelo === modeloSel) ?? null;

    const fonte = modelo
      ? modelo.revisoes.map((r) => {
          const ref = referencia.find((x) => x.numero === r.numero);
          const meses = r.meses ?? ref?.meses ?? PRAZO_PADRAO[r.numero]?.meses ?? r.numero * 6;
          return { numero: r.numero, km: r.km, meses, estimado: r.meses == null };
        })
      : referencia.map((r) => ({ ...r, estimado: true }));

    return fonte
      .slice()
      .sort((a, b) => a.numero - b.numero)
      .map((r) => {
        const limite = addMeses(base, r.meses);
        return { ...r, limite, vencida: hoje.getTime() > limite.getTime() };
      });
  }, [dataCompra, modeloSel, data, referencia]);

  const proximaIdx = linhas.findIndex((l) => !l.vencida);

  return (
    <section
      className="flex flex-col gap-4 rounded-[22px] p-6"
      style={{ background: "var(--card-bg)", border: "1px solid var(--border-line-soft)", fontFamily: FONT }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 style={{ fontFamily: FONT, fontSize: 16.5, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
            Prazo de garantia das revisões
          </h2>
          <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--text-muted)", margin: 0 }}>
            Informe a data de compra da moto (manual/nota fiscal) para ver quais revisões ainda estão no prazo.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
              Data de compra
            </span>
            <input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-line)",
                color: "var(--text-primary)",
                padding: "9px 12px",
                borderRadius: 12,
                fontSize: 13,
                fontFamily: FONT,
                fontWeight: 500,
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-line)")}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
              Modelo (opcional)
            </span>
            <select
              value={modeloSel}
              onChange={(e) => setModeloSel(e.target.value)}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-line)",
                color: "var(--text-primary)",
                padding: "9px 12px",
                borderRadius: 12,
                fontSize: 13,
                fontFamily: FONT,
                fontWeight: 500,
                outline: "none",
                maxWidth: 250,
              }}
            >
              <option value="">Prazos padrão da linha</option>
              {data.modelos.map((m, i) => (
                <option key={m.modelo + i} value={m.modelo}>
                  {nomeCurto(m.modelo)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {linhas.length === 0 ? (
        <div
          className="rounded-2xl px-4 py-6 text-center text-[12.5px] font-medium"
          style={{ background: "var(--bg-panel-2)", border: "1px dashed var(--border-line)", color: "var(--text-muted)" }}
        >
          Preencha a data de compra para calcular os prazos das {referencia.length} revisões.
        </div>
      ) : (
        <>
          {/* Linha do tempo horizontal */}
          <div className="relative flex gap-3 overflow-x-auto pb-1.5">
            {linhas.map((l, i) => {
              const proxima = i === proximaIdx;
              return (
                <div
                  key={l.numero}
                  className="flex min-w-[150px] flex-1 flex-col gap-1.5 rounded-2xl px-3.5 py-3"
                  style={{
                    background: proxima ? `${ACCENT}14` : "var(--bg-panel-2)",
                    border: `1px solid ${proxima ? ACCENT : "var(--border-line-soft)"}`,
                    opacity: l.vencida ? 0.62 : 1,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold"
                      style={{
                        background: l.vencida ? "var(--border-line)" : ACCENT,
                        color: l.vencida ? "var(--text-muted)" : "#fff",
                      }}
                    >
                      {l.numero}
                    </span>
                    <span className="text-[12.5px] font-semibold">{l.km.toLocaleString("pt-BR")} km</span>
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {l.meses} meses · até {fmtData(l.limite)}
                  </div>
                  <StatusBadge
                    status={l.vencida ? "Vencida" : proxima ? "Próxima válida" : "No prazo"}
                    variant={l.vencida ? "expired" : proxima ? "review" : "success"}
                    size="sm"
                    className="self-start"
                  />
                </div>
              );
            })}
          </div>

          <div className="text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>
            {proximaIdx === -1 ? (
              <>Todas as revisões já passaram do prazo de garantia por tempo.</>
            ) : (
              <>
                Próxima revisão coberta:{" "}
                <b style={{ color: ACCENT }}>
                  {linhas[proximaIdx].numero}ª ({linhas[proximaIdx].km.toLocaleString("pt-BR")} km) — até{" "}
                  {fmtData(linhas[proximaIdx].limite)}
                </b>
                . Vale o que vencer primeiro (km ou tempo).
              </>
            )}
            {!modeloSel && " Prazos de referência da linha — selecione o modelo para usar os meses cadastrados dele."}
          </div>
        </>
      )}
    </section>
  );
}
