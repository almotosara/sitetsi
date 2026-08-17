"use client";

// Calculadora de TMO para troca de peça avulsa (fora de revisão programada).
//
// Importante: o TMO informado aqui NÃO é o campo "TMO" do MicroWork
// (lá ele é sempre 1,0000 para o serviço TROCA DE PEÇAS 1775). Aqui ele é só
// o fator de tempo da peça, usado para calcular a mão de obra que vai no
// campo "Valor Hora" do MicroWork.

import { useMemo, useState } from "react";
import { urlTrocaPeca } from "../../lib/motos-catalog";
import { nomeCurto } from "../../lib/motos-catalog";
import { fmtBRL, findGrupoMaoDeObra, type RevisoesData, type ValorItem } from "../../lib/revisoes-calc";

const ACCENT = "#d71920";
const FONT = "var(--font-poppins), Poppins, sans-serif";

function parseNum(s: string): number | null {
  const v = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-line)",
  color: "var(--text-primary)",
  padding: "10px 13px",
  borderRadius: 12,
  fontSize: 13.5,
  fontFamily: FONT,
  fontWeight: 500,
  outline: "none",
  width: "100%",
};

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline gap-2">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
        {children}
      </span>
      {hint && (
        <span className="text-[10.5px] font-medium" style={{ color: "var(--text-dim, var(--text-muted))" }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function Toggle({
  value,
  onChange,
  a,
  b,
}: {
  value: "cadastro" | "manual";
  onChange: (v: "cadastro" | "manual") => void;
  a: string;
  b: string;
}) {
  return (
    <div className="mb-2 flex gap-1.5">
      {(["cadastro", "manual"] as const).map((k) => {
        const ativo = value === k;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            className="rounded-xl px-3 py-1.5 text-[11.5px] font-semibold cursor-pointer motion-safe:transition-colors"
            style={{
              background: ativo ? `${ACCENT}22` : "transparent",
              color: ativo ? ACCENT : "var(--text-muted)",
              border: `1px solid ${ativo ? ACCENT : "var(--border-line)"}`,
            }}
          >
            {k === "cadastro" ? a : b}
          </button>
        );
      })}
    </div>
  );
}

export function TmoCalculadora({ data }: { data: RevisoesData }) {
  // Peça
  const [modoPeca, setModoPeca] = useState<"cadastro" | "manual">("cadastro");
  const [qPeca, setQPeca] = useState("");
  const [pecaSel, setPecaSel] = useState<ValorItem | null>(null);
  const [pecaManualDesc, setPecaManualDesc] = useState("");
  const [pecaManualValor, setPecaManualValor] = useState("");

  // TMO da peça
  const [tmoTxt, setTmoTxt] = useState("1");

  // Moto / valor hora
  const [modoMoto, setModoMoto] = useState<"cadastro" | "manual">("cadastro");
  const [modeloSel, setModeloSel] = useState("");
  const [horaManual, setHoraManual] = useState("");

  const resultados = useMemo(() => {
    const text = qPeca.trim().toLowerCase();
    if (!text) return [];
    return data.valores_mercadoria
      .filter((v) => v.descricao.toLowerCase().includes(text) || v.codigo.toLowerCase().includes(text))
      .slice(0, 25);
  }, [qPeca, data]);

  const grupo = useMemo(
    () => (modeloSel ? findGrupoMaoDeObra(modeloSel, data.mao_de_obra) : null),
    [modeloSel, data]
  );

  const valorPeca = modoPeca === "cadastro" ? pecaSel?.valor ?? null : parseNum(pecaManualValor);
  const descPeca = modoPeca === "cadastro" ? pecaSel?.descricao ?? null : pecaManualDesc.trim() || null;
  const codPeca = modoPeca === "cadastro" ? pecaSel?.codigo ?? null : null;
  const tmo = parseNum(tmoTxt);
  const valorHora = modoMoto === "cadastro" ? grupo?.tmo_hora_valor ?? null : parseNum(horaManual);

  const maoDeObra = valorHora != null && tmo != null ? valorHora * tmo : null;
  const total = (valorPeca ?? 0) + (maoDeObra ?? 0);
  const podeAbrir = valorPeca != null && maoDeObra != null;

  function abrirOS() {
    if (valorPeca == null || maoDeObra == null) return;
    const url = urlTrocaPeca({
      modelo: modoMoto === "cadastro" ? modeloSel || null : null,
      pecaCodigo: codPeca,
      pecaDescricao: descPeca,
      pecaValor: Number(valorPeca.toFixed(2)),
      maoDeObra: Number(maoDeObra.toFixed(2)),
    });
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="tmo-grid responsive-grid grid gap-5" style={{ fontFamily: FONT, gridTemplateColumns: "minmax(300px, 1.3fr) minmax(260px, 1fr)" }}>
      {/* ─── Formulário ─── */}
      <div
        className="flex flex-col gap-5 rounded-[22px] p-6"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border-line-soft)" }}
      >
        {/* Peça */}
        <div>
          <Label>1. Peça / mercadoria</Label>
          <Toggle value={modoPeca} onChange={setModoPeca} a="Usar cadastro" b="Valor manual" />
          {modoPeca === "cadastro" ? (
            <>
              <input
                value={pecaSel ? `${pecaSel.codigo} — ${pecaSel.descricao}` : qPeca}
                onChange={(e) => {
                  setPecaSel(null);
                  setQPeca(e.target.value);
                }}
                placeholder="Buscar por código ou descrição (ex: PASTILHA, 0613…)"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-line)")}
              />
              {!pecaSel && qPeca.trim() && (
                <div
                  className="mt-2 max-h-[230px] overflow-y-auto rounded-xl"
                  style={{ background: "var(--bg-panel-2)", border: "1px solid var(--border-line-soft)" }}
                >
                  {resultados.length === 0 && (
                    <div className="px-3 py-2.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                      Nenhum item encontrado.
                    </div>
                  )}
                  {resultados.map((v, i) => (
                    <button
                      key={v.codigo + i}
                      onClick={() => {
                        setPecaSel(v);
                        setQPeca("");
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12.5px] cursor-pointer"
                      style={{ background: "transparent", border: "none", borderBottom: "1px solid var(--border-line-soft)" }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold" style={{ color: "var(--text-primary)" }}>
                          {v.descricao}
                        </span>
                        <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {v.codigo}
                        </span>
                      </span>
                      <b style={{ color: ACCENT }}>{fmtBRL(v.valor)}</b>
                    </button>
                  ))}
                </div>
              )}
              {pecaSel && (
                <button
                  onClick={() => setPecaSel(null)}
                  className="mt-1.5 text-[11px] cursor-pointer"
                  style={{ background: "none", border: "none", color: "var(--text-muted)", padding: 0 }}
                >
                  trocar peça
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                value={pecaManualDesc}
                onChange={(e) => setPecaManualDesc(e.target.value)}
                placeholder="Descrição da peça"
                style={inputStyle}
              />
              <input
                value={pecaManualValor}
                onChange={(e) => setPecaManualValor(e.target.value)}
                inputMode="decimal"
                placeholder="Valor da peça (ex: 189,90)"
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {/* TMO */}
        <div>
          <Label hint="fator de tempo da peça — não é o campo TMO do MicroWork">2. TMO da peça</Label>
          <input
            value={tmoTxt}
            onChange={(e) => setTmoTxt(e.target.value)}
            inputMode="decimal"
            placeholder="ex: 0,8 · 1 · 1,2"
            style={{ ...inputStyle, maxWidth: 180 }}
          />
          <p className="mt-1.5 text-[11px] font-medium leading-snug" style={{ color: "var(--text-muted)" }}>
            No MicroWork o campo <b>TMO</b> fica sempre <b>1,0000</b> para o serviço TROCA DE PEÇAS (1775). Este número
            aqui serve só para calcular quanto vale a mão de obra, que vai no campo <b>Valor Hora</b>.
          </p>
        </div>

        {/* Moto */}
        <div>
          <Label>3. Motocicleta / valor da hora</Label>
          <Toggle value={modoMoto} onChange={setModoMoto} a="Selecionar modelo" b="Valor manual" />
          {modoMoto === "cadastro" ? (
            <>
              <select value={modeloSel} onChange={(e) => setModeloSel(e.target.value)} style={inputStyle}>
                <option value="">Selecione o modelo…</option>
                {data.modelos.map((m, i) => (
                  <option key={m.modelo + i} value={m.modelo}>
                    {nomeCurto(m.modelo)}
                  </option>
                ))}
              </select>
              <div className="mt-1.5 text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>
                {modeloSel
                  ? grupo
                    ? `Grupo: ${grupo.modelos} · hora ${fmtBRL(grupo.tmo_hora_valor)}`
                    : "Não achei o grupo de mão de obra deste modelo — use o valor manual."
                  : "O valor da hora vem da tabela de mão de obra do grupo do modelo."}
              </div>
            </>
          ) : (
            <input
              value={horaManual}
              onChange={(e) => setHoraManual(e.target.value)}
              inputMode="decimal"
              placeholder="Valor da hora (ex: 185,90)"
              style={{ ...inputStyle, maxWidth: 220 }}
            />
          )}
        </div>
      </div>

      {/* ─── Resumo ─── */}
      <div
        className="flex h-fit flex-col gap-3.5 rounded-[22px] p-6"
        style={{ background: "var(--card-bg)", border: `1px solid ${ACCENT}44` }}
      >
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
          Resumo da troca
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] font-medium" style={{ color: "var(--text-muted)" }}>
            Valor da peça
          </span>
          <b className="text-[15px]">{valorPeca != null ? fmtBRL(valorPeca) : "—"}</b>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] font-medium" style={{ color: "var(--text-muted)" }}>
            Mão de obra
            <span className="block text-[10.5px]">
              {valorHora != null && tmo != null ? `${fmtBRL(valorHora)} × ${tmo} TMO` : "informe modelo e TMO"}
            </span>
          </span>
          <b className="text-[15px]">{maoDeObra != null ? fmtBRL(maoDeObra) : "—"}</b>
        </div>

        <div className="pt-3" style={{ borderTop: "1px solid var(--border-line-soft)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12.5px] font-semibold">Total</span>
            <span style={{ color: ACCENT, fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em" }}>
              {podeAbrir ? fmtBRL(total) : "—"}
            </span>
          </div>
        </div>

        <button
          onClick={abrirOS}
          disabled={!podeAbrir}
          className="mt-1 w-full rounded-2xl px-4 py-3.5 text-[13.5px] font-semibold motion-safe:transition-all motion-safe:duration-300"
          style={{
            background: podeAbrir ? ACCENT : "var(--bg-panel-2)",
            color: podeAbrir ? "#fff" : "var(--text-muted)",
            border: podeAbrir ? "none" : "1px solid var(--border-line)",
            cursor: podeAbrir ? "pointer" : "not-allowed",
            boxShadow: podeAbrir ? "0 16px 30px -18px rgba(215,25,32,.9)" : "none",
          }}
        >
          Abrir OS desta troca
        </button>

        <p className="text-[11px] font-medium leading-snug" style={{ color: "var(--text-muted)" }}>
          Abre o MicroWork em <b>Tipo 7 — Externo Expresso</b>, serviço <b>TROCA DE PEÇAS (1775)</b>, TMO 1,0000 e
          Valor Hora já com a mão de obra calculada.
        </p>
      </div>
    </div>
  );
}
