'use client'

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Wrench,
  Package,
  BookOpen,
  Upload,
  Search,
  Bell,
  Settings as SettingsIcon,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  Trash2,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { parseOSFile } from "@/lib/os-parser";
import type { OSLinha } from "@/lib/os-types";

const STORAGE_KEY = "os_linhas_v1";
type Tab = "overview" | "servicos" | "materiais" | "manual";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtInt(v: number) {
  return v.toLocaleString("pt-BR");
}
function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export function OSDashboard({ userName, userEmail, renderManual }: { userName?: string; userEmail?: string; renderManual?: () => React.ReactNode } = {}) {
  const [linhas, setLinhas] = useState<OSLinha[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [dateIni, setDateIni] = useState("");
  const [dateFim, setDateFim] = useState("");
  const [fSit, setFSit] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fCons, setFCons] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLinhas(JSON.parse(raw));
    } catch {}
  }, []);

  function persist(data: OSLinha[]) {
    setLinhas(data);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseOSFile(file);
      persist(parsed);
      showToast(`${parsed.length} linhas importadas com sucesso`);
    } catch (err: any) {
      showToast(`Erro ao importar: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const filtered = useMemo(() => {
    return linhas.filter((l) => {
      if (dateIni && l.emissao < new Date(dateIni).toISOString()) return false;
      if (dateFim) {
        const end = new Date(dateFim);
        end.setHours(23, 59, 59, 999);
        if (l.emissao > end.toISOString()) return false;
      }
      if (fSit && l.situacao !== fSit) return false;
      if (fTipo && l.tipo_os !== fTipo) return false;
      if (fCons && l.consultor !== fCons) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !l.numero_os.toLowerCase().includes(q) &&
          !l.pessoa.toLowerCase().includes(q) &&
          !l.modelo.toLowerCase().includes(q) &&
          !l.placa.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [linhas, dateIni, dateFim, fSit, fTipo, fCons, search]);

  const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean))).sort();
  const situacoes = uniq(linhas.map((l) => l.situacao));
  const tipos = uniq(linhas.map((l) => l.tipo_os));
  const consultores = uniq(linhas.map((l) => l.consultor));

  // Aggregates
  const byOS = useMemo(() => {
    const map = new Map<string, { total: number; linhas: OSLinha[] }>();
    for (const l of filtered) {
      const e = map.get(l.numero_os) ?? { total: 0, linhas: [] };
      e.total += l.valor_total;
      e.linhas.push(l);
      map.set(l.numero_os, e);
    }
    return map;
  }, [filtered]);

  const totalOS = byOS.size;
  const totalReceita = filtered.reduce((s, l) => s + l.valor_total, 0);
  const totalMercadoria = filtered.reduce((s, l) => s + l.total_mercadoria, 0);
  const totalServico = filtered.reduce((s, l) => s + l.total_servico, 0);
  const seguradora = filtered.filter(
    (l) => l.tipo_os === "SEGURADORA" || l.tipo_os === "PROTEÇÃO VEÍCULAR",
  );
  const totalSeguradora = seguradora.reduce((s, l) => s + l.valor_total, 0);

  // Sparkline data grouped by day
  const spark = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const l of filtered) {
      const d = l.emissao ? l.emissao.slice(0, 10) : "";
      if (!d) continue;
      byDay.set(d, (byDay.get(d) ?? 0) + l.valor_total);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => ({ d, v }));
  }, [filtered]);

  // Ranking tipos
  const rankingTipos = useMemo(() => {
    const map = new Map<string, { qtd: number; total: number }>();
    for (const l of filtered) {
      const e = map.get(l.tipo_os) ?? { qtd: 0, total: 0 };
      e.qtd += 1;
      e.total += l.valor_total;
      map.set(l.tipo_os, e);
    }
    return Array.from(map.entries())
      .map(([tipo, v]) => ({ tipo, ...v }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [filtered]);

  // Materiais por tipo (resumo por Tipo O.S.)
  const materiaisPorTipo = useMemo(() => {
    const map = new Map<string, { qtd: number; mercadoria: number }>();
    for (const l of filtered) {
      const e = map.get(l.tipo_os) ?? { qtd: 0, mercadoria: 0 };
      e.qtd += 1;
      e.mercadoria += l.total_mercadoria;
      map.set(l.tipo_os, e);
    }
    return Array.from(map.entries())
      .map(([tipo, v]) => ({ tipo, ...v }))
      .sort((a, b) => b.mercadoria - a.mercadoria);
  }, [filtered]);

  const hasData = linhas.length > 0;

  return (
    <div className="os-dashboard min-h-screen text-slate-200" style={{ background: "#0a0a0f" }}>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex">
        {/* Sidebar */}
        <aside
          className="w-64 shrink-0 border-r border-white/5 min-h-screen p-4 flex flex-col gap-1"
          style={{ background: "#0d0d14" }}
        >
          <div className="flex items-center gap-2 px-2 py-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 grid place-items-center font-bold text-white">
              A
            </div>
            <div>
              <div className="font-semibold text-white text-sm leading-tight">
                Alagoas Motos <span className="text-[10px] align-super text-violet-400">®</span>
              </div>
              <div className="text-[11px] text-slate-500">Ordens de Serviço</div>
            </div>
          </div>

          <NavItem
            active={tab === "overview"}
            onClick={() => setTab("overview")}
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Dashboard"
          />
          <NavItem
            active={tab === "servicos"}
            onClick={() => setTab("servicos")}
            icon={<Wrench className="h-4 w-4" />}
            label="Serviços e valores"
            badge={hasData ? String(filtered.length) : undefined}
          />
          <NavItem
            active={tab === "materiais"}
            onClick={() => setTab("materiais")}
            icon={<Package className="h-4 w-4" />}
            label="Materiais utilizados"
          />
          <NavItem
            active={tab === "manual"}
            onClick={() => setTab("manual")}
            icon={<BookOpen className="h-4 w-4" />}
            label="Manual de Manutenção"
          />

          <div className="mt-auto">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-2xl p-3 text-left bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-lg shadow-violet-900/30 hover:brightness-110 transition"
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                <Upload className="h-4 w-4" /> Importar planilha
              </div>
              <div className="text-[11px] text-violet-100/80 mt-1">
                .xlsx exportado do Microwork
              </div>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* Top bar */}
          <div
            className="flex items-center gap-3 px-8 h-16 border-b border-white/5"
            style={{ background: "#0d0d14" }}
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600" />
              <div className="text-sm">
                <div className="text-white font-medium leading-tight">{userName || "Oficina"}</div>
                <div className="text-[11px] text-slate-500">{userEmail || "oficina@alagoasmotos.com"}</div>
              </div>
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                PRO
              </span>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="ml-4 px-4 h-9 rounded-full bg-violet-500/20 text-violet-200 text-xs font-medium border border-violet-500/30 hover:bg-violet-500/30 transition inline-flex items-center gap-2"
            >
              <Upload className="h-3.5 w-3.5" /> Importar O.S.
            </button>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 pr-3 h-9 rounded-full bg-white/5 border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 w-56 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <button className="h-9 w-9 rounded-full bg-white/5 border border-white/10 grid place-items-center text-slate-400 hover:text-white">
                <Bell className="h-4 w-4" />
              </button>
              <button className="h-9 px-3 rounded-full bg-white/5 border border-white/10 grid place-items-center text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-xs">
                <SettingsIcon className="h-3.5 w-3.5" /> Settings
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Filters */}
            <FiltersBar
              dateIni={dateIni}
              dateFim={dateFim}
              setDateIni={setDateIni}
              setDateFim={setDateFim}
              fSit={fSit}
              setFSit={setFSit}
              fTipo={fTipo}
              setFTipo={setFTipo}
              fCons={fCons}
              setFCons={setFCons}
              situacoes={situacoes}
              tipos={tipos}
              consultores={consultores}
              onClear={() => {
                setDateIni("");
                setDateFim("");
                setFSit("");
                setFTipo("");
                setFCons("");
              }}
              onWipe={
                hasData
                  ? () => {
                      if (confirm("Remover todos os dados importados?")) persist([]);
                    }
                  : undefined
              }
            />

            {!hasData && <EmptyState onImport={() => fileRef.current?.click()} loading={loading} />}

            {hasData && tab === "overview" && (
              <OverviewTab
                totalOS={totalOS}
                totalReceita={totalReceita}
                totalMercadoria={totalMercadoria}
                totalServico={totalServico}
                totalSeguradora={totalSeguradora}
                seguradoraQtd={new Set(seguradora.map((l) => l.numero_os)).size}
                spark={spark}
                ranking={rankingTipos}
                onImport={() => fileRef.current?.click()}
              />
            )}

            {hasData && tab === "servicos" && <ServicosTab linhas={filtered} />}

            {hasData && tab === "materiais" && (
              <MateriaisTab rows={materiaisPorTipo} modelos={uniq(filtered.map((l) => l.modelo))} linhas={filtered} />
            )}

            {tab === "manual" && (renderManual ? <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#14141c" }}>{renderManual()}</div> : <ManualTab />)}
          </div>
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 rounded-xl bg-violet-600 text-white text-sm px-4 py-3 shadow-2xl shadow-violet-900/40 border border-violet-400/30">
          {toast}
        </div>
      )}
      {loading && (
        <div className="fixed inset-0 grid place-items-center bg-black/60 z-50">
          <div className="rounded-2xl px-6 py-4 bg-[#14141c] border border-white/10 text-slate-200 text-sm">
            Processando planilha…
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition ${
        active ? "bg-white/5 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-violet-500" />
      )}
      {icon}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
          {badge}
        </span>
      )}
    </button>
  );
}

function FiltersBar(props: {
  dateIni: string;
  dateFim: string;
  setDateIni: (v: string) => void;
  setDateFim: (v: string) => void;
  fSit: string;
  setFSit: (v: string) => void;
  fTipo: string;
  setFTipo: (v: string) => void;
  fCons: string;
  setFCons: (v: string) => void;
  situacoes: string[];
  tipos: string[];
  consultores: string[];
  onClear: () => void;
  onWipe?: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-white/5 p-4 flex flex-wrap items-end gap-3"
      style={{ background: "#14141c" }}
    >
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2">
        <Filter className="h-3.5 w-3.5" /> Filtros
      </div>
      <Field label="De">
        <input
          type="date"
          value={props.dateIni}
          onChange={(e) => props.setDateIni(e.target.value)}
          className="ds-input"
        />
      </Field>
      <Field label="Até">
        <input
          type="date"
          value={props.dateFim}
          onChange={(e) => props.setDateFim(e.target.value)}
          className="ds-input"
        />
      </Field>
      <Field label="Situação">
        <select value={props.fSit} onChange={(e) => props.setFSit(e.target.value)} className="ds-input">
          <option value="">Todas</option>
          {props.situacoes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipo O.S.">
        <select value={props.fTipo} onChange={(e) => props.setFTipo(e.target.value)} className="ds-input">
          <option value="">Todos</option>
          {props.tipos.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Consultor">
        <select value={props.fCons} onChange={(e) => props.setFCons(e.target.value)} className="ds-input">
          <option value="">Todos</option>
          {props.consultores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <button
        onClick={props.onClear}
        className="ml-auto text-xs px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
      >
        Limpar
      </button>
      {props.onWipe && (
        <button
          onClick={props.onWipe}
          className="text-xs px-3 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 inline-flex items-center gap-1.5"
        >
          <Trash2 className="h-3 w-3" /> Limpar dados
        </button>
      )}
      <style>{`.ds-input{background:#0d0d14;border:1px solid rgba(255,255,255,.08);color:#e2e8f0;font-size:12px;padding:0 10px;height:36px;border-radius:8px;min-width:120px}
      .ds-input:focus{outline:none;border-color:rgba(139,92,246,.5)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function EmptyState({ onImport, loading }: { onImport: () => void; loading: boolean }) {
  return (
    <div
      className="rounded-3xl border border-white/5 p-16 text-center"
      style={{ background: "#14141c" }}
    >
      <div className="mx-auto h-14 w-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 grid place-items-center mb-4">
        <Upload className="h-6 w-6 text-violet-400" />
      </div>
      <h3 className="text-white text-lg font-semibold">Nenhuma O.S. importada ainda</h3>
      <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
        Importe a planilha <span className="text-slate-200">Relatório de O.S. por data</span>{" "}
        exportada do Microwork Cloud para começar.
      </p>
      <button
        onClick={onImport}
        disabled={loading}
        className="mt-6 px-5 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white text-sm font-medium shadow-lg shadow-violet-900/30 inline-flex items-center gap-2"
      >
        <Upload className="h-4 w-4" /> Importar planilha
      </button>
    </div>
  );
}

function OverviewTab(props: {
  totalOS: number;
  totalReceita: number;
  totalMercadoria: number;
  totalServico: number;
  totalSeguradora: number;
  seguradoraQtd: number;
  spark: { d: string; v: number }[];
  ranking: { tipo: string; qtd: number; total: number }[];
  onImport: () => void;
}) {
  const cards = [
    { label: "O.S. no período", value: fmtInt(props.totalOS), sub: "únicas", color: "#8b5cf6" },
    { label: "Receita total", value: fmtBRL(props.totalReceita), sub: "valor total", color: "#22c55e" },
    { label: "Serviços", value: fmtBRL(props.totalServico), sub: "mão de obra", color: "#38bdf8" },
    { label: "Mercadorias", value: fmtBRL(props.totalMercadoria), sub: "peças/insumos", color: "#f59e0b" },
  ];
  return (
    <>
      {/* Recommendation header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-slate-500">Recomendações do período</div>
          <h2 className="text-white text-2xl font-semibold mt-1">
            Ordens de Serviço <span className="text-slate-500 text-lg font-normal">— visão geral</span>
          </h2>
        </div>
        <div className="hidden md:flex gap-2">
          <Pill label="24H" />
          <Pill label="Todos os tipos" />
          <Pill label="Desc" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_360px] gap-4">
        {cards.slice(0, 3).map((c, i) => (
          <MetricCard key={i} card={c} spark={props.spark} idx={i} />
        ))}
        {/* Highlight card */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden text-white"
          style={{
            background:
              "radial-gradient(120% 120% at 100% 0%, rgba(167,139,250,.6) 0%, rgba(109,40,217,.9) 40%, rgba(45,15,90,1) 100%)",
          }}
        >
          <div className="flex items-start justify-between">
            <div className="text-sm font-medium">Alagoas Motos<span className="text-[10px] align-super">®</span></div>
            <span className="text-[10px] bg-white/15 border border-white/20 rounded-full px-2 py-0.5">New</span>
          </div>
          <h3 className="mt-4 text-xl font-semibold leading-tight">
            Seguradora & Proteção<br />Veicular
          </h3>
          <p className="text-xs text-violet-100/80 mt-2 max-w-[260px]">
            {props.seguradoraQtd} linhas · {fmtBRL(props.totalSeguradora)} no período filtrado.
          </p>
          <div className="mt-5 space-y-2">
            <button
              onClick={props.onImport}
              className="w-full h-10 rounded-full bg-white text-violet-800 text-xs font-semibold inline-flex items-center justify-center gap-2"
            >
              <Upload className="h-3.5 w-3.5" /> Importar nova planilha
            </button>
            <button className="w-full h-10 rounded-full bg-transparent border border-white/40 text-white text-xs font-medium inline-flex items-center justify-center gap-2">
              Ver detalhes <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Ranking */}
      <div
        className="rounded-2xl border border-white/5 p-6"
        style={{ background: "#14141c" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-slate-500">Ranking</div>
            <h3 className="text-white text-lg font-semibold">Tipos de O.S. mais abertos</h3>
          </div>
        </div>
        <div className="space-y-2">
          {props.ranking.slice(0, 10).map((r) => {
            const max = props.ranking[0]?.qtd || 1;
            const pct = (r.qtd / max) * 100;
            return (
              <div key={r.tipo} className="flex items-center gap-3">
                <div className="w-52 text-xs text-slate-300 truncate">{r.tipo || "—"}</div>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-16 text-right text-xs text-slate-300">{fmtInt(r.qtd)}</div>
                <div className="w-28 text-right text-xs text-slate-500">{fmtBRL(r.total)}</div>
              </div>
            );
          })}
          {props.ranking.length === 0 && (
            <div className="text-sm text-slate-500 py-6 text-center">Nenhum dado para os filtros atuais.</div>
          )}
        </div>
      </div>
    </>
  );
}

function MetricCard({
  card,
  spark,
  idx,
}: {
  card: { label: string; value: string; sub: string; color: string };
  spark: { d: string; v: number }[];
  idx: number;
}) {
  const delta = spark.length > 1 ? spark[spark.length - 1].v - spark[0].v : 0;
  const up = delta >= 0;
  return (
    <div
      className="rounded-2xl border border-white/5 p-5 relative overflow-hidden"
      style={{ background: "#14141c" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-xl grid place-items-center"
            style={{ background: `${card.color}22`, color: card.color }}
          >
            <span className="font-bold text-xs">{idx + 1}</span>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{card.sub}</div>
            <div className="text-xs text-slate-300 font-medium">{card.label}</div>
          </div>
        </div>
        <button className="text-slate-500 hover:text-white">
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 text-3xl font-bold text-white tracking-tight">{card.value}</div>
      <div className={`mt-1 inline-flex items-center gap-1 text-[11px] ${up ? "text-emerald-400" : "text-red-400"}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? "+" : ""}
        {fmtBRL(delta)}
      </div>
      <div className="h-16 mt-3 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={spark}>
            <defs>
              <linearGradient id={`g${idx}`} x1="0" x2="1">
                <stop offset="0%" stopColor={card.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={card.color} stopOpacity="0.3" />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{ background: "#0d0d14", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(v: any) => fmtBRL(Number(v))}
            />
            <Line type="monotone" dataKey="v" stroke={`url(#g${idx})`} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
      {label}
    </span>
  );
}

function ServicosTab({ linhas }: { linhas: OSLinha[] }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: keyof OSLinha; dir: 1 | -1 }>({
    key: "emissao",
    dir: -1,
  });
  const pageSize = 25;

  const sorted = useMemo(() => {
    const arr = [...linhas];
    arr.sort((a, b) => {
      const av = a[sort.key] as any;
      const bv = b[sort.key] as any;
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
    return arr;
  }, [linhas, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totals = sorted.reduce(
    (acc, l) => {
      acc.desc += l.total_desconto;
      acc.serv += l.total_servico;
      acc.acr += l.total_acrescimo;
      acc.merc += l.total_mercadoria;
      acc.tot += l.valor_total;
      return acc;
    },
    { desc: 0, serv: 0, acr: 0, merc: 0, tot: 0 },
  );

  function header(label: string, key: keyof OSLinha, align: "left" | "right" = "left") {
    const active = sort.key === key;
    return (
      <th
        onClick={() =>
          setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: 1 }))
        }
        className={`px-3 py-3 text-[11px] uppercase tracking-wide text-slate-500 font-medium cursor-pointer select-none ${
          align === "right" ? "text-right" : "text-left"
        } ${active ? "text-violet-300" : ""}`}
      >
        {label}
        {active && (sort.dir === 1 ? " ↑" : " ↓")}
      </th>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#14141c" }}>
      <div className="flex items-center justify-between p-5 border-b border-white/5">
        <div>
          <div className="text-xs text-slate-500">Detalhado por linha</div>
          <h3 className="text-white text-lg font-semibold">Serviços e valores</h3>
        </div>
        <div className="text-xs text-slate-400">{sorted.length} linhas</div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02]">
            <tr>
              {header("Emissão", "emissao")}
              {header("Nº O.S.", "numero_os")}
              {header("Situação", "situacao")}
              {header("Tipo O.S.", "tipo_os")}
              {header("Cliente", "pessoa")}
              {header("Modelo", "modelo")}
              {header("Placa", "placa")}
              {header("Desc.", "total_desconto", "right")}
              {header("Serviço", "total_servico", "right")}
              {header("Acréscimo", "total_acrescimo", "right")}
              {header("Mercadoria", "total_mercadoria", "right")}
              {header("Total", "valor_total", "right")}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((l, i) => (
              <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{fmtDate(l.emissao)}</td>
                <td className="px-3 py-2.5 text-white font-medium">{l.numero_os}</td>
                <td className="px-3 py-2.5">
                  <SituacaoBadge s={l.situacao} />
                </td>
                <td className="px-3 py-2.5 text-slate-300">{l.tipo_os}</td>
                <td className="px-3 py-2.5 text-slate-300 max-w-[220px] truncate">{l.pessoa}</td>
                <td className="px-3 py-2.5 text-slate-400">{l.modelo}</td>
                <td className="px-3 py-2.5 text-slate-400">{l.placa}</td>
                <td className="px-3 py-2.5 text-right text-slate-400">{fmtBRL(l.total_desconto)}</td>
                <td className="px-3 py-2.5 text-right text-slate-300">{fmtBRL(l.total_servico)}</td>
                <td className="px-3 py-2.5 text-right text-slate-400">{fmtBRL(l.total_acrescimo)}</td>
                <td className="px-3 py-2.5 text-right text-slate-300">{fmtBRL(l.total_mercadoria)}</td>
                <td className="px-3 py-2.5 text-right text-white font-semibold">{fmtBRL(l.valor_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10 bg-white/[0.03]">
              <td colSpan={7} className="px-3 py-3 text-xs text-slate-400 font-medium">
                Totais ({sorted.length} linhas)
              </td>
              <td className="px-3 py-3 text-right text-slate-300 text-xs">{fmtBRL(totals.desc)}</td>
              <td className="px-3 py-3 text-right text-slate-300 text-xs">{fmtBRL(totals.serv)}</td>
              <td className="px-3 py-3 text-right text-slate-300 text-xs">{fmtBRL(totals.acr)}</td>
              <td className="px-3 py-3 text-right text-slate-300 text-xs">{fmtBRL(totals.merc)}</td>
              <td className="px-3 py-3 text-right text-white font-bold text-xs">{fmtBRL(totals.tot)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex items-center justify-between p-4 border-t border-white/5 text-xs text-slate-400">
        <div>
          Página {page + 1} de {pages}
        </div>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 h-8 rounded-lg bg-white/5 border border-white/10 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            className="px-3 h-8 rounded-lg bg-white/5 border border-white/10 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

function SituacaoBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    ABERTA: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    PENDENTE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    CONCLUÍDA: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    PARADA: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    CANCELADA: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  const cls = map[s] ?? "bg-white/5 text-slate-300 border-white/10";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>{s || "—"}</span>
  );
}

function MateriaisTab({
  rows,
  modelos,
  linhas,
}: {
  rows: { tipo: string; qtd: number; mercadoria: number }[];
  modelos: string[];
  linhas: OSLinha[];
}) {
  const [modelo, setModelo] = useState("");
  const filteredRows = useMemo(() => {
    if (!modelo) return rows;
    const map = new Map<string, { qtd: number; mercadoria: number }>();
    for (const l of linhas) {
      if (l.modelo !== modelo) continue;
      const e = map.get(l.tipo_os) ?? { qtd: 0, mercadoria: 0 };
      e.qtd += 1;
      e.mercadoria += l.total_mercadoria;
      map.set(l.tipo_os, e);
    }
    return Array.from(map.entries())
      .map(([tipo, v]) => ({ tipo, ...v }))
      .sort((a, b) => b.mercadoria - a.mercadoria);
  }, [modelo, rows, linhas]);

  const total = filteredRows.reduce((s, r) => s + r.mercadoria, 0);

  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#14141c" }}>
      <div className="flex items-center justify-between p-5 border-b border-white/5 gap-3 flex-wrap">
        <div>
          <div className="text-xs text-slate-500">Resumo por Tipo O.S.</div>
          <h3 className="text-white text-lg font-semibold">Materiais utilizados</h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-md">
            A planilha não traz peças item a item — o resumo abaixo agrega quantidade de linhas e{" "}
            <span className="text-slate-300">Total Mercadoria</span> por tipo.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Field label="Modelo">
            <select value={modelo} onChange={(e) => setModelo(e.target.value)} className="ds-input">
              <option value="">Todos</option>
              {modelos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-white/[0.02]">
          <tr>
            <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-500 font-medium">Tipo O.S.</th>
            <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-500 font-medium">Linhas</th>
            <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-500 font-medium">Total mercadoria</th>
            <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-500 font-medium">% do total</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((r) => {
            const pct = total > 0 ? (r.mercadoria / total) * 100 : 0;
            return (
              <tr key={r.tipo} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-200">{r.tipo || "—"}</td>
                <td className="px-4 py-3 text-right text-slate-300">{fmtInt(r.qtd)}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{fmtBRL(r.mercadoria)}</td>
                <td className="px-4 py-3 text-right text-violet-300">{pct.toFixed(1)}%</td>
              </tr>
            );
          })}
          {filteredRows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                Nenhum dado para os filtros atuais.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/10 bg-white/[0.03]">
            <td className="px-4 py-3 text-xs text-slate-400 font-medium">Total</td>
            <td />
            <td className="px-4 py-3 text-right text-white font-bold text-xs">{fmtBRL(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ManualTab() {
  return (
    <div
      className="rounded-2xl border border-white/5 p-8"
      style={{ background: "#14141c" }}
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-violet-500/10 border border-violet-500/20 grid place-items-center">
          <BookOpen className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-white text-lg font-semibold">Manual de Manutenção</h3>
          <p className="text-slate-400 text-sm">Consulta de revisões, mão de obra e valores de mercadoria.</p>
        </div>
      </div>
      <p className="text-sm text-slate-400 mt-6">
        Esta é a visualização legada do <span className="text-slate-200">Manual de Manutenção</span> (baseada em{" "}
        <code className="text-violet-300">public/data/revisoes.json</code>). No projeto Next.js completo entregue no
        zip, este bloco integra o componente <code className="text-violet-300">OficinaShell</code> original como
        aba secundária — a dashboard de O.S. é a tela principal.
      </p>
    </div>
  );
}
