"use client";

import { useMemo, useState } from "react";
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
  type Modelo,
  type RevisoesData,
} from "../../lib/revisoes-calc";

const ACCENT = "#0f7a5a";

/* ────────────────────────────── Galeria ────────────────────────────── */

function MotoCard({ modelo, onOpen }: { modelo: Modelo; onOpen: () => void }) {
  const v = visualDoModelo(modelo.modelo);
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col items-center rounded-2xl p-4 cursor-pointer transition-transform text-center hover:-translate-y-1"
      style={{ background: "var(--card-bg)", border: "1px solid var(--border-line-soft)" }}
    >
      <div
        className="flex items-center justify-center w-full h-[120px] mb-2.5 overflow-hidden rounded-xl"
        style={{ background: "#fff" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={v.foto}
          alt={modelo.modelo}
          loading="lazy"
          className="max-h-[120px] w-auto object-contain transition-transform duration-300 group-hover:scale-105"
          style={{ opacity: v.temFotoPropria ? 1 : 0.45 }}
        />
      </div>
      <div className="font-bold text-[13.5px] leading-tight" style={{ color: "var(--text-primary)" }}>
        {nomeCurto(modelo.modelo)}
      </div>
      <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
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

  const r = modelo.revisoes[revisaoIdx];
  const { maoDeObra, total, estimado } = totalRevisao(r, modelo.modelo, data.mao_de_obra);
  const categoriaNome = CATEGORIAS.find((c) => c.id === v.categoria)?.nome ?? "Outros";

  function abrirOS(numero: number) {
    const rev = modelo.revisoes.find((x) => x.numero === numero);
    const url = urlOrdemServico({
      modelo: modelo.modelo,
      revisao: numero,
      kmMeses: rev ? `${rev.km} KM${rev.meses ? ` ou ${rev.meses} meses` : ""}` : undefined,
    });
    window.open(url, "_blank", "noopener");
    setEscolhendoOS(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onVoltar}
        className="self-start text-[12.5px] font-semibold cursor-pointer"
        style={{ color: ACCENT }}
      >
        ← Voltar às motos
      </button>

      <div
        className="rounded-2xl p-6 grid gap-6"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-line-soft)",
          gridTemplateColumns: "minmax(260px, 1.2fr) minmax(240px, 1fr)",
        }}
      >
        {/* Coluna da foto */}
        <div className="flex flex-col min-w-0">
          <div className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: "var(--text-muted)" }}>
            {categoriaNome}
          </div>
          <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
            {nomeCurto(modelo.modelo)}
          </h2>
          <div className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>
            {anosDoModelo(modelo.modelo, modelo.periodo)} · {modelo.revisoes.length} revisões cadastradas
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={v.foto}
            alt={modelo.modelo}
            className="w-full max-h-[260px] object-contain rounded-xl"
            style={{ background: "#fff", opacity: v.temFotoPropria ? 1 : 0.45 }}
          />
        </div>

        {/* Coluna das ações (área marcada em azul no print) */}
        <div className="flex flex-col justify-center gap-3">
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: "var(--bg-panel-2)", border: "1px solid var(--border-line-soft)" }}
          >
            <div className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: "var(--text-muted)" }}>
              Próxima revisão selecionada
            </div>
            <div className="text-[14px] font-bold">
              {r.numero}ª · {r.km.toLocaleString("pt-BR")} km
              {r.meses ? ` ou ${r.meses} meses` : ""}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: ACCENT, fontWeight: 700 }}>
              {fmtBRL(total)}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                ({r.mao_de_obra_gratis ? "M.O. grátis" : `M.O. ${fmtBRL(maoDeObra)}${estimado ? "*" : ""}`})
              </span>
            </div>
          </div>

          {!escolhendoOS ? (
            <button
              onClick={() => setEscolhendoOS(true)}
              className="w-full rounded-xl px-4 py-3 text-[13.5px] font-bold cursor-pointer transition-opacity hover:opacity-90"
              style={{ background: ACCENT, color: "#fff", border: "none" }}
            >
              Abrir ordem de serviço
            </button>
          ) : (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: "var(--bg-panel-2)", border: `1px solid ${ACCENT}55` }}
            >
              <div className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                Qual revisão vai abrir no MicroWork?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {modelo.revisoes.map((rev) => (
                  <button
                    key={rev.numero}
                    onClick={() => abrirOS(rev.numero)}
                    className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer"
                    style={{ background: ACCENT, color: "#fff", border: "none" }}
                  >
                    {rev.numero}ª · {rev.km.toLocaleString("pt-BR")}km
                  </button>
                ))}
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
            className="w-full rounded-xl px-4 py-3 text-[13.5px] font-bold cursor-pointer transition-colors"
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              border: "1px solid var(--border-line)",
            }}
          >
            {mostrarValores ? "Ocultar valores de revisões" : "Ver valores de revisões"}
          </button>

          <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
            A OS abre em <b>microworkcloud.com.br</b> já com a moto e a revisão escolhidas. Informe a placa ou o chassi
            do veículo e o autofill continua sozinho.
          </p>
        </div>
      </div>

      {/* Valores de revisões */}
      {mostrarValores && (
        <div className="flex flex-col gap-4">
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            style={{ borderBottom: "1px solid var(--border-line-soft)" }}
          >
            {modelo.revisoes.map((rev, i) => (
              <button
                key={rev.numero}
                onClick={() => setRevisaoIdx(i)}
                className="flex-shrink-0 px-3.5 py-2 text-[12.5px] font-bold cursor-pointer rounded-t-[9px] transition-colors"
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

          <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border-line-soft)" }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 16, fontWeight: 700, margin: 0 }}>
                {r.numero}ª Revisão — {r.km.toLocaleString("pt-BR")} km{r.meses ? ` ou ${r.meses} meses` : ""}
              </h3>
              <div className="flex items-center gap-2">
                {r.tmo_horas != null && (
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: `${ACCENT}26`, color: ACCENT }}
                  >
                    TMO: {r.tmo_horas}h
                  </span>
                )}
                <button
                  onClick={() => abrirOS(r.numero)}
                  className="text-[11.5px] font-bold px-3 py-1.5 rounded-full cursor-pointer"
                  style={{ background: ACCENT, color: "#fff", border: "none" }}
                >
                  Abrir OS desta revisão
                </button>
              </div>
            </div>

            {r.servicos.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {r.servicos.map((s, i) => (
                  <span
                    key={i}
                    title={s.acao}
                    className="text-[11px] px-2 py-1 rounded-full"
                    style={{ background: "var(--bg-panel-2)", color: "var(--text-dim)", border: "1px solid var(--border-line-soft)" }}
                  >
                    {s.servico}
                  </span>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] border-collapse">
                <thead>
                  <tr>
                    {["Peça", "Código", "Valor unit.", "Qtd.", "Total"].map((h, i) => (
                      <th
                        key={h}
                        className="px-2 py-1.5 text-[10px] uppercase tracking-widest font-bold"
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
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-line-soft)" }}>
                      <td className="px-2 py-1.5">{p.descricao}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {p.codigo || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">{fmtBRL(p.valor_unitario)}</td>
                      <td className="px-2 py-1.5 text-right">{p.quantidade ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{fmtBRL(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className="flex justify-end items-center gap-6 mt-3 pt-3 text-[12.5px] flex-wrap"
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
                    className="ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#ffb02e26", color: "#ffb02e" }}
                    title="Calculado a partir do TMO × valor/hora do grupo"
                  >
                    estimado
                  </span>
                )}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                Total: <b style={{ color: ACCENT }}>{fmtBRL(total)}</b>
              </span>
            </div>
          </div>

          {/* Resumo de todas as revisões */}
          <div className="overflow-x-auto rounded-2xl" style={{ background: "var(--card-bg)", border: "1px solid var(--border-line-soft)" }}>
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr>
                  {["Revisão", "Km / meses", "Peças", "Mão de obra", "Total", ""].map((h, i) => (
                    <th
                      key={h + i}
                      className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold"
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
                      style={{ borderBottom: "1px solid var(--border-line-soft)", cursor: "pointer" }}
                      onClick={() => setRevisaoIdx(i)}
                    >
                      <td className="px-3 py-2 font-semibold">{rev.numero}ª</td>
                      <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>
                        {rev.km.toLocaleString("pt-BR")} km{rev.meses ? ` ou ${rev.meses} meses` : ""}
                      </td>
                      <td className="px-3 py-2 text-right">{fmtBRL(rev.pecas_total)}</td>
                      <td className="px-3 py-2 text-right">{rev.mao_de_obra_gratis ? "Grátis" : fmtBRL(t.maoDeObra)}</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: ACCENT }}>
                        {fmtBRL(t.total)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirOS(rev.numero);
                          }}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer"
                          style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}66` }}
                        >
                          Abrir OS
                        </button>
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Encontre a moto… (ex: POP 110, PCX, CB 300)"
          className="w-full max-w-sm"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-line)",
            color: "var(--text-primary)",
            padding: "10px 14px",
            borderRadius: 9,
            fontSize: 13.5,
            outline: "none",
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          {(["todas", ...CATEGORIAS.map((c) => c.id)] as const).map((id) => {
            const ativo = catFiltro === id;
            const label = id === "todas" ? "Todas" : CATEGORIAS.find((c) => c.id === id)!.nome;
            return (
              <button
                key={id}
                onClick={() => setCatFiltro(id as CategoriaId | "todas")}
                className="px-3 py-1.5 rounded-full text-[12px] font-bold cursor-pointer transition-colors"
                style={{
                  background: ativo ? ACCENT : "transparent",
                  color: ativo ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${ativo ? ACCENT : "var(--border-line-soft)"}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {grupos.length === 0 && (
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma moto encontrada.
        </div>
      )}

      {grupos.map((g) => (
        <section key={g.categoria.id} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--border-line-soft)" }} />
            <h2
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: ACCENT,
                margin: 0,
              }}
            >
              {g.categoria.nome}
            </h2>
            <div className="flex-1 h-px" style={{ background: "var(--border-line-soft)" }} />
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {g.motos.map((m, mi) => (
              <MotoCard key={m.modelo + m.periodo + mi} modelo={m} onOpen={() => setSelecionado(m)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
