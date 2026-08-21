// Tipos + cálculo de mão de obra das revisões (compartilhado entre as telas).

export interface Peca {
  descricao: string;
  codigo: string | null;
  valor_unitario: number | null;
  quantidade: number | null;
  total: number | null;
}
export interface Servico {
  servico: string;
  acao: string;
}
export interface Revisao {
  numero: number;
  km: number;
  meses: number | null;
  tmo_horas: number | null;
  pecas: Peca[];
  servicos: Servico[];
  pecas_total: number;
  mao_de_obra_gratis: boolean;
  mao_de_obra_valor: number | null;
  servico_dms_codigo?: string | null;
  total: number;
}
export interface Modelo {
  modelo: string;
  periodo: string;
  revisoes: Revisao[];
}
export interface MaoDeObraRow {
  modelos: string;
  tmo_hora_valor: number;
  revisao_geral_valor: number | null;
}
export interface ValorItem {
  codigo: string;
  descricao: string;
  valor: number;
}
export interface RevisoesData {
  modelos: Modelo[];
  mao_de_obra: MaoDeObraRow[];
  valores_mercadoria: ValorItem[];
}

export function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normTok(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function wordsOf(s: string) {
  return s
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((w) => w.length >= 2);
}
const STOP_WORDS = new Set(["DE", "DA", "DO"]);

export function baseModelo(modelo: string) {
  return modelo
    .replace(/\(.*?\)/g, " ")
    .split(/\s-\s/)[0]
    .split("•")[0]
    .replace(/\b(19|20)\d{2}\b/g, "")
    .trim();
}

function findGrupoPorToken(modelo: string, grupos: MaoDeObraRow[]): MaoDeObraRow | null {
  const base = normTok(baseModelo(modelo));
  const baseClean = base.replace(/I$/, "");
  let best: MaoDeObraRow | null = null;
  let bestLen = 0;
  for (const g of grupos) {
    const tokens = g.modelos.split("/").map((t) => normTok(t)).filter(Boolean);
    for (const t of tokens) {
      const tClean = t.replace(/I$/, "");
      if (tClean === baseClean) return g;
      if (base.includes(t) || t.includes(base) || base.includes(tClean) || tClean.includes(baseClean)) {
        if (tClean.length > bestLen) {
          bestLen = tClean.length;
          best = g;
        }
      }
    }
  }
  return best;
}

function findGrupoPorPalavras(modelo: string, grupos: MaoDeObraRow[]): MaoDeObraRow | null {
  const baseWords = wordsOf(baseModelo(modelo)).filter((w) => !STOP_WORDS.has(w));
  let best: MaoDeObraRow | null = null;
  let bestScore = 0;
  for (const g of grupos) {
    const gw = wordsOf(g.modelos);
    let score = 0;
    for (const bw of baseWords) {
      for (const w of gw) {
        if (bw === w) score += 2;
        else if (/^\d/.test(bw) && /^\d/.test(w) && (bw.startsWith(w) || w.startsWith(bw))) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return bestScore > 0 ? best : null;
}

export function findGrupoMaoDeObra(modelo: string, grupos: MaoDeObraRow[]): MaoDeObraRow | null {
  return findGrupoPorToken(modelo, grupos) || findGrupoPorPalavras(modelo, grupos);
}

/** Valor fixo da revisão geral definido para o grupo do modelo. */
export function valorRevisaoGeral(modelo: string, grupos: MaoDeObraRow[]): number | null {
  const valor = findGrupoMaoDeObra(modelo, grupos)?.revisao_geral_valor;
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

export function estimarMaoDeObra(
  revisao: Revisao,
  modelo: string,
  grupos: MaoDeObraRow[]
): { valor: number | null; estimado: boolean } {
  if (revisao.mao_de_obra_gratis) return { valor: null, estimado: false };
  if (revisao.mao_de_obra_valor != null) return { valor: revisao.mao_de_obra_valor, estimado: false };
  if (revisao.tmo_horas == null) return { valor: null, estimado: false };
  const grupo = findGrupoMaoDeObra(modelo, grupos);
  if (!grupo || !Number.isFinite(grupo.tmo_hora_valor)) return { valor: null, estimado: false };
  return { valor: revisao.tmo_horas * grupo.tmo_hora_valor, estimado: true };
}

/** Total final da revisão, já considerando mão de obra grátis/estimada. */
export function totalRevisao(r: Revisao, modelo: string, grupos: MaoDeObraRow[]) {
  const { valor, estimado } = estimarMaoDeObra(r, modelo, grupos);
  const maoDeObra = r.mao_de_obra_gratis ? null : r.mao_de_obra_valor ?? valor;
  const total = r.mao_de_obra_gratis
    ? r.pecas_total
    : r.mao_de_obra_valor != null
      ? r.total
      : r.pecas_total + (maoDeObra ?? 0);
  return { maoDeObra, total, estimado };
}
