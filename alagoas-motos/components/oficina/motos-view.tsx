"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIAS,
  anosDoModelo,
  nomeCurto,
  urlOrdemServico,
  visualDoModelo,
  type CategoriaId,
} from "../../lib/motos-catalog";
import {
  fmtBRL,
  totalRevisao,
  estimarMaoDeObra,
  valorRevisaoGeral,
  type Modelo,
  type RevisoesData,
} from "../../lib/revisoes-calc";
import { PrazoRevisaoCard } from "./prazo-revisao";
import { ShinyButton } from "@/components/ui/shiny-button";

const ACCENT = "#d71920";
const FONT = "var(--font-poppins), Poppins, sans-serif";

/* ────────────────────────────── Galeria ────────────────────────────── */

function MotoCard({ modelo, onOpen, index }: { modelo: Modelo; onOpen: () => void; index: number }) {
  const v = visualDoModelo(modelo.modelo);
  return (
    <button
      onClick={onOpen}
      className="moto-card group relative flex flex-col items-center overflow-hidden rounded-[22px] p-5 text-center cursor-pointer animate-oficina-rise motion-safe:transition-all motion-safe:duration-[420ms] hover:-translate-y-1.5"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-line-soft)",
        transitionTimingFunction: "cubic-bezier(.22,1,.36,1)",
        animationDelay: `${Math.min(index, 12) * 45}ms`,
        fontFamily: FONT,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 22px 45px -24px rgba(215,25,32,.45)";
        e.currentTarget.style.borderColor = `${ACCENT}55`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--border-line-soft)";
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-0 motion-safe:transition-opacity motion-safe:duration-500 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }}
      />
      <div
        className="mb-4 flex h-[170px] w-full items-center justify-center overflow-hidden rounded-2xl"
        style={{ background: "#fff" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={v.foto}
          alt={modelo.modelo}
          width={860}
          height={550}
          loading="lazy"
          decoding="async"
          className="max-h-[168px] w-auto object-contain motion-safe:transition-transform motion-safe:duration-[550ms] group-hover:scale-[1.09]"
          style={{ opacity: v.temFotoPropria ? 1 : 0.45, transitionTimingFunction: "cubic-bezier(.22,1,.36,1)" }}
        />
      </div>
      <div className="text-[15px] font-semibold leading-tight tracking-tight" style={{ color: "var(--text-primary)" }}>
        {nomeCurto(modelo.modelo)}
      </div>
      <div className="mt-1.5 text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>
        {anosDoModelo(modelo.modelo, modelo.periodo)} · {modelo.revisoes.length} revisões
      </div>
    </button>
  );
}

/* ────────────────────────────── Detalhe ────────────────────────────── */

function DetalheMoto({
  modelo,
  data,
  onVoltar,
}: {
  modelo: Modelo;
  data: RevisoesData;
  onVoltar: () => void;
}) {
  const v = visualDoModelo(modelo.modelo);
  const [revisaoIdx, setRevisaoIdx] = useState(0);
  const [mostrarValores, setMostrarValores] = useState(false);
  const [escolhendoOS, setEscolhendoOS] = useState(false);
  // "Revisão geral" = cliente fora da garantia: serviço único e mão de obra cobrada.
  // Só se aplica da 3ª revisão em diante (1ª/2ª são sempre cortesia).
  const [geral, setGeral] = useState(false);

  const r = modelo.revisoes[revisaoIdx];
  const { maoDeObra, total, estimado } = totalRevisao(r, modelo.modelo, data.mao_de_obra);
  const categoriaNome = CATEGORIAS.find((c) => c.id === v.categoria)?.nome ?? "Outros";

  function abrirOS(numero: number, geralOverride?: boolean) {
    const rev = modelo.revisoes.find((x) => x.numero === numero);
    // "geral" só existe da 3ª revisão em diante
    const ehGeral = numero >= 3 && (geralOverride ?? geral);
    // Revisão normal: valor explícito ou estimativa pelo T.M.O do grupo.
    // Revisão geral: prioriza o preço fixo configurado para o grupo do modelo.
    const calc = rev ? totalRevisao(rev, modelo.modelo, data.mao_de_obra) : null;
    let mo: number | null = ehGeral
      ? valorRevisaoGeral(modelo.modelo, data.mao_de_obra)
      : calc?.maoDeObra ?? null;
    if (ehGeral && mo == null && rev) {
      // Compatibilidade defensiva para bases antigas sem revisao_geral_valor.
      mo = rev.mao_de_obra_valor ?? (rev.tmo_horas != null
        ? estimarMaoDeObra({ ...rev, mao_de_obra_gratis: false }, modelo.modelo, data.mao_de_obra).valor
        : null);
    }
    const url = urlOrdemServico({
      modelo: modelo.modelo,
      revisao: numero,
      kmMeses: rev ? `${rev.km} KM${rev.meses ? ` ou ${rev.meses} meses` : ""}` : undefined,
      maoDeObra: mo,
      geral: ehGeral,
      servicoCodigo: rev?.servico_dms_codigo,
    });
    window.open(url, "_blank", "noopener");
    setEscolhendoOS(false);
  }

  function abrirTrocaOleo() {
    const url = urlOrdemServico({ modelo: modelo.modelo, tipo: "troca_oleo" });
    window.open(url, "_blank", "noopener");
    setEscolhendoOS(false);
  }

  return (
    <div className="flex flex-col gap-6 animate-oficina-fade" style={{ fontFamily: FONT }}>
      <button
        onClick={onVoltar}
        className="group self-start text-[12.5px] font-semibold cursor-pointer motion-safe:transition-colors"
        style={{ color: ACCENT }}
      >
        <span className="inline-block motion-safe:transition-transform motion-safe:duration-300 group-hover:-translate-x-1">←</span>{" "}
        Voltar às motos
      </button>

      <div
        className="moto-detail-grid responsive-grid grid gap-8 rounded-[26px] p-7"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-line-soft)",
          gridTemplateColumns: "minmax(280px, 1.25fr) minmax(280px, 1fr)",
          boxShadow: "0 26px 60px -46px rgba(20,30,25,.55)",
        }}
      >
        {/* Coluna da foto */}
        <div className="flex min-w-0 flex-col">
          <div
            className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--text-muted)" }}
          >
            {categoriaNome}
          </div>
          <h2 style={{ fontFamily: FONT, fontSize: 30, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {nomeCurto(modelo.modelo)}
          </h2>
          <div className="mb-4 text-[12.5px] font-medium" style={{ color: "var(--text-muted)" }}>
            {anosDoModelo(modelo.modelo, modelo.periodo)} · {modelo.revisoes.length} revisões cadastradas
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={modelo.modelo}
            src={v.foto}
            alt={modelo.modelo}
            width={860}
            height={550}
            loading="lazy"
            decoding="async"
            className="w-full max-h-[360px] rounded-2xl object-contain animate-oficina-zoom"
            style={{ background: "#fff", opacity: v.temFotoPropria ? 1 : 0.45 }}
          />
        </div>

        {/* Coluna das ações */}
        <div className="flex flex-col justify-center gap-3.5">
          <div
            className="rounded-2xl px-5 py-4 motion-safe:transition-colors"
            style={{ background: "var(--bg-panel-2)", border: "1px solid var(--border-line-soft)" }}
          >
            <div
              className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--text-muted)" }}
            >
              Próxima revisão selecionada
            </div>
            <div className="text-[14.5px] font-semibold">
              {r.numero}ª · {r.km.toLocaleString("pt-BR")} km
              {r.meses ? ` ou ${r.meses} meses` : ""}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span
                key={`${revisaoIdx}-${total}`}
                className="animate-oficina-pop"
                style={{ color: ACCENT, fontWeight: 700, fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.02em" }}
              >
                {fmtBRL(total)}
              </span>
              <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                ({r.mao_de_obra_gratis ? "M.O. grátis" : `M.O. ${fmtBRL(maoDeObra)}${estimado ? "*" : ""}`})
              </span>
            </div>
          </div>

          {!escolhendoOS ? (
            <ShinyButton
              onClick={() => setEscolhendoOS(true)}
              size="wide"
              className="w-full"
            >
              Abrir ordem de serviço
            </ShinyButton>
          ) : (
            <div
              className="flex flex-col gap-2.5 rounded-2xl p-4 animate-oficina-rise"
              style={{ background: "var(--bg-panel-2)", border: `1px solid ${ACCENT}55` }}
            >
              <div className="text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>
                O que vai abrir no MicroWork?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {modelo.revisoes.map((rev) => (
                  <button
                    key={rev.numero}
                    onClick={() => abrirOS(rev.numero)}
                    className="rounded-xl px-3 py-1.5 text-[12px] font-semibold cursor-pointer motion-safe:transition-transform hover:scale-[1.04]"
                    style={{
                      background: geral && rev.numero >= 3 ? "transparent" : ACCENT,
                      color: geral && rev.numero >= 3 ? ACCENT : "#fff",
                      border: geral && rev.numero >= 3 ? `1px solid ${ACCENT}` : "none",
                      opacity: geral && rev.numero < 3 ? 0.45 : 1,
                    }}
                  >
                    {rev.numero}ª · {rev.km.toLocaleString("pt-BR")}km
                  </button>
                ))}
              </div>
              {modelo.revisoes.some((rev) => rev.numero >= 3) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setGeral(false)}
                    className="rounded-xl px-3 py-1.5 text-[11.5px] font-semibold cursor-pointer"
                    style={{
                      background: geral ? "transparent" : `${ACCENT}22`,
                      color: geral ? "var(--text-muted)" : ACCENT,
                      border: `1px solid ${geral ? "var(--border-line)" : ACCENT}`,
                    }}
                  >
                    Dentro da garantia
                  </button>
                  <button
                    onClick={() => setGeral(true)}
                    className="rounded-xl px-3 py-1.5 text-[11.5px] font-semibold cursor-pointer"
                    style={{
                      background: geral ? `${ACCENT}22` : "transparent",
                      color: geral ? ACCENT : "var(--text-muted)",
                      border: `1px solid ${geral ? ACCENT : "var(--border-line)"}`,
                    }}
                  >
                    Fora da garantia (revisão geral)
                  </button>
                  <span className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                    válido da 3ª revisão em diante
                  </span>
                </div>
              )}
              <div
                className="mt-0.5 pt-2.5"
                style={{ borderTop: "1px solid var(--border-line-soft)" }}
              >
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
                  Serviço avulso
                </div>
                <button
                  onClick={abrirTrocaOleo}
                  className="rounded-xl px-3 py-1.5 text-[12px] font-semibold cursor-pointer motion-safe:transition-transform hover:scale-[1.04]"
                  style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}` }}
                >
                  Troca de óleo
                </button>
              </div>
              <button
                onClick={() => setEscolhendoOS(false)}
                className="self-start text-[11.5px] cursor-pointer"
                style={{ color: "var(--text-muted)", background: "none", border: "none", padding: 0 }}
              >
                cancelar
              </button>
            </div>
          )}

          <button
            onClick={() => setMostrarValores((s) => !s)}
            className="w-full rounded-2xl px-4 py-3.5 text-[14px] font-semibold cursor-pointer motion-safe:transition-all motion-safe:duration-300 hover:-translate-y-0.5"
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              border: "1px solid var(--border-line)",
            }}
          >
            {mostrarValores ? "Ocultar valores de revisões" : "Ver valores de revisões"}
          </button>

          <p className="text-[11.5px] font-medium leading-snug" style={{ color: "var(--text-muted)" }}>
            A OS abre em <b>microworkcloud.com.br</b> já com a moto e a revisão escolhidas. Informe a placa ou o chassi
            do veículo e o autofill continua sozinho.
          </p>
        </div>
      </div>

      {/* Valores de revisões */}
      {mostrarValores && (
        <div className="flex flex-col gap-4 animate-oficina-rise">
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            style={{ borderBottom: "1px solid var(--border-line-soft)" }}
          >
            {modelo.revisoes.map((rev, i) => (
              <button
                key={rev.numero}
                onClick={() => setRevisaoIdx(i)}
                className="flex-shrink-0 rounded-t-xl px-4 py-2.5 text-[12.5px] font-semibold cursor-pointer motion-safe:transition-all motion-safe:duration-300"
                style={{
                  color: revisaoIdx === i ? ACCENT : "var(--text-muted)",
                  background: revisaoIdx === i ? "var(--card-bg)" : "transparent",
                  borderBottom: revisaoIdx === i ? `2px solid ${ACCENT}` : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {rev.numero}ª · {rev.km.toLocaleString("pt-BR")}km
              </button>
            ))}
          </div>

          <div
            key={revisaoIdx}
            className="rounded-[22px] p-6 animate-oficina-fade"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border-line-soft)" }}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
                {r.numero}ª Revisão — {r.km.toLocaleString("pt-BR")} km{r.meses ? ` ou ${r.meses} meses` : ""}
              </h3>
              <div className="flex items-center gap-2">
                {r.tmo_horas != null && (
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: `${ACCENT}1f`, color: ACCENT }}
                  >
                    TMO: {r.tmo_horas}h
                  </span>
                )}
                <button
                  onClick={() => abrirOS(r.numero, false)}
                  className="rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold cursor-pointer motion-safe:transition-transform hover:scale-[1.04]"
                  style={{ background: ACCENT, color: "#fff", border: "none" }}
                >
                  Abrir OS desta revisão
                </button>
                {r.numero >= 3 && (
                  <button
                    onClick={() => abrirOS(r.numero, true)}
                    title="Abrir OS fora da garantia (revisão geral, mão de obra cobrada)"
                    className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold cursor-pointer motion-safe:transition-transform hover:scale-[1.04]"
                    style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}` }}
                  >
                    OS geral
                  </button>
                )}
              </div>
            </div>

            {r.servicos.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {r.servicos.map((s, i) => (
                  <span
                    key={i}
                    title={s.acao}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      background: "var(--bg-panel-2)",
                      color: "var(--text-dim)",
                      border: "1px solid var(--border-line-soft)",
                    }}
                  >
                    {s.servico}
                  </span>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {["Peça", "Código", "Valor unit.", "Qtd.", "Total"].map((h, i) => (
                      <th
                        key={h}
                        className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{
                          textAlign: i === 0 ? "left" : "right",
                          color: "var(--text-muted)",
                          borderBottom: "1px solid var(--border-line-soft)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.pecas.map((p, i) => (
                    <tr
                      key={i}
                      className="motion-safe:transition-colors"
                      style={{ borderBottom: "1px solid var(--border-line-soft)" }}
                    >
                      <td className="px-2.5 py-2">{p.descricao}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {p.codigo || "—"}
                      </td>
                      <td className="px-2.5 py-2 text-right">{fmtBRL(p.valor_unitario)}</td>
                      <td className="px-2.5 py-2 text-right">{p.quantidade ?? "—"}</td>
                      <td className="px-2.5 py-2 text-right font-semibold">{fmtBRL(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className="mt-4 flex flex-wrap items-center justify-end gap-6 pt-4 text-[13px]"
              style={{ borderTop: "1px solid var(--border-line-soft)" }}
            >
              <span style={{ color: "var(--text-muted)" }}>
                Peças: <b style={{ color: "var(--text-primary)" }}>{fmtBRL(r.pecas_total)}</b>
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                Mão de obra:{" "}
                <b style={{ color: "var(--text-primary)" }}>{r.mao_de_obra_gratis ? "Grátis" : fmtBRL(maoDeObra)}</b>
                {estimado && (
                  <span
                    className="ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: "#ffb02e26", color: "#ffb02e" }}
                    title="Calculado a partir do TMO × valor/hora do grupo"
                  >
                    estimado
                  </span>
                )}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                Total:{" "}
                <b style={{ color: ACCENT, fontSize: 18 }}>{fmtBRL(total)}</b>
              </span>
            </div>
          </div>

          {/* Resumo de todas as revisões */}
          <div
            className="overflow-x-auto rounded-[22px]"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border-line-soft)" }}
          >
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {["Revisão", "Km / meses", "Peças", "Mão de obra", "Total", ""].map((h, i) => (
                    <th
                      key={h + i}
                      className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        textAlign: i === 0 || i === 1 ? "left" : "right",
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border-line-soft)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modelo.revisoes.map((rev, i) => {
                  const t = totalRevisao(rev, modelo.modelo, data.mao_de_obra);
                  return (
                    <tr
                      key={rev.numero}
                      className="motion-safe:transition-colors"
                      style={{
                        borderBottom: "1px solid var(--border-line-soft)",
                        cursor: "pointer",
                        background: revisaoIdx === i ? "var(--bg-panel-2)" : "transparent",
                      }}
                      onClick={() => setRevisaoIdx(i)}
                    >
                      <td className="px-3.5 py-2.5 font-semibold">{rev.numero}ª</td>
                      <td className="px-3.5 py-2.5" style={{ color: "var(--text-muted)" }}>
                        {rev.km.toLocaleString("pt-BR")} km{rev.meses ? ` ou ${rev.meses} meses` : ""}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">{fmtBRL(rev.pecas_total)}</td>
                      <td className="px-3.5 py-2.5 text-right">
                        {rev.mao_de_obra_gratis ? "Grátis" : fmtBRL(t.maoDeObra)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold" style={{ color: ACCENT }}>
                        {fmtBRL(t.total)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirOS(rev.numero, false);
                            }}
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer motion-safe:transition-colors"
                            style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}66` }}
                          >
                            Abrir OS
                          </button>
                          {rev.numero >= 3 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirOS(rev.numero, true);
                              }}
                              title="Fora da garantia (revisão geral): serviço único, mão de obra cobrada"
                              className="rounded-full px-2 py-1 text-[11px] font-semibold cursor-pointer motion-safe:transition-colors"
                              style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-line)" }}
                            >
                              geral
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────── View principal ────────────────────────────── */

const POPULARES = ["POP", "BIZ", "BROS", "CG"];

export function MotosView({ data }: { data: RevisoesData }) {
  const [q, setQ] = useState("");
  const [catFiltro, setCatFiltro] = useState<CategoriaId | "todas">("todas");
  const [selecionado, setSelecionado] = useState<Modelo | null>(null);

  useEffect(() => {
    if (selecionado) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selecionado]);

  const grupos = useMemo(() => {
    const text = q.trim().toLowerCase();
    const filtrados = data.modelos.filter((m) => {
      if (text && !m.modelo.toLowerCase().includes(text)) return false;
      if (catFiltro !== "todas" && visualDoModelo(m.modelo).categoria !== catFiltro) return false;
      return true;
    });
    return CATEGORIAS.map((c) => ({
      categoria: c,
      motos: filtrados
        .filter((m) => visualDoModelo(m.modelo).categoria === c.id)
        .sort((a, b) => {
          const pa = POPULARES.findIndex((p) => a.modelo.toUpperCase().includes(p));
          const pb = POPULARES.findIndex((p) => b.modelo.toUpperCase().includes(p));
          return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
        }),
    })).filter((g) => g.motos.length > 0);
  }, [data, q, catFiltro]);

  if (selecionado) {
    return <DetalheMoto modelo={selecionado} data={data} onVoltar={() => setSelecionado(null)} />;
  }

  return (
    <div className="flex flex-col gap-6" style={{ fontFamily: FONT }}>
      <PrazoRevisaoCard data={data} />

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Encontre a moto… (ex: POP 110, PCX, CB 300)"
          className="w-full max-w-sm motion-safe:transition-all motion-safe:duration-300 focus:shadow-[0_0_0_4px_rgba(215,25,32,.12)]"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-line)",
            color: "var(--text-primary)",
            padding: "11px 16px",
            borderRadius: 14,
            fontSize: 13.5,
            fontFamily: FONT,
            fontWeight: 500,
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-line)")}
        />
        <div className="flex flex-wrap gap-1.5">
          {(["todas", ...CATEGORIAS.map((c) => c.id)] as const).map((id) => {
            const ativo = catFiltro === id;
            const label = id === "todas" ? "Todas" : CATEGORIAS.find((c) => c.id === id)!.nome;
            return (
              <button
                key={id}
                onClick={() => setCatFiltro(id as CategoriaId | "todas")}
                className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold cursor-pointer motion-safe:transition-all motion-safe:duration-300 hover:-translate-y-0.5"
                style={{
                  background: ativo ? ACCENT : "transparent",
                  color: ativo ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${ativo ? ACCENT : "var(--border-line-soft)"}`,
                  boxShadow: ativo ? "0 12px 24px -16px rgba(215,25,32,.9)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {grupos.length === 0 && (
        <div className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Nenhuma moto encontrada.
        </div>
      )}

      {grupos.map((g) => (
        <section key={g.categoria.id} className="flex flex-col gap-4 animate-oficina-fade">
          <div className="flex items-center gap-3">
            <h2
              style={{
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: ACCENT,
                margin: 0,
              }}
            >
              {g.categoria.nome}
            </h2>
            <div className="h-px flex-1" style={{ background: "var(--border-line-soft)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              {g.motos.length}
            </span>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
            {g.motos.map((m, mi) => (
              <MotoCard key={m.modelo + m.periodo + mi} modelo={m} index={mi} onOpen={() => setSelecionado(m)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
