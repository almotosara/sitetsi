// ─────────────────────────────────────────────────────────────────────────────
// Catálogo visual das motos da oficina.
// Cruza os modelos vindos de /data/revisoes.json com foto + categoria,
// e monta o link do MicroWork Cloud com os parâmetros do autofill.
// ─────────────────────────────────────────────────────────────────────────────

export type CategoriaId = "city" | "scooter" | "street" | "trail" | "big" | "outros";

export interface CategoriaInfo {
  id: CategoriaId;
  nome: string;
}

export const CATEGORIAS: CategoriaInfo[] = [
  { id: "city", nome: "City" },
  { id: "scooter", nome: "Scooter" },
  { id: "street", nome: "Street" },
  { id: "trail", nome: "Trail / Adventure" },
  { id: "big", nome: "Big Trail / Esportivas" },
  { id: "outros", nome: "Outros" },
];

interface Regra {
  /** Termos (normalizados) que precisam aparecer no nome do modelo. */
  contem: string[];
  /** Termos que NÃO podem aparecer. */
  exceto?: string[];
  foto: string;
  categoria: CategoriaId;
}

function norm(s: string) {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

// A ordem importa: a primeira regra que casar vence (mais específica primeiro).
const REGRAS: Regra[] = [
  { contem: ["BIZ125EX"], foto: "biz125-ex", categoria: "city" },
  { contem: ["BIZ125"], foto: "biz125-es", categoria: "city" },
  { contem: ["BIZ110"], foto: "biz125-es", categoria: "city" },
  { contem: ["POP"], foto: "pop110", categoria: "city" },

  { contem: ["ELITE"], foto: "elite125", categoria: "scooter" },
  { contem: ["PCX160"], foto: "pcx160-dlx", categoria: "scooter" },
  { contem: ["PCX150"], foto: "pcx160-cbs", categoria: "scooter" },
  { contem: ["PCX"], foto: "pcx160-abs", categoria: "scooter" },
  { contem: ["XADV"], foto: "x-adv", categoria: "scooter" },
  { contem: ["ADV"], exceto: ["XADV"], foto: "adv160", categoria: "scooter" },
  { contem: ["SH150"], foto: "pcx160-cbs", categoria: "scooter" },
  { contem: ["SH300"], foto: "x-adv", categoria: "scooter" },
  { contem: ["FORZA"], foto: "x-adv", categoria: "scooter" },

  { contem: ["CARGO"], foto: "cg160-cargo", categoria: "city" },
  { contem: ["CG160START"], foto: "cg160-start", categoria: "city" },
  { contem: ["CG160FAN"], foto: "cg160-fan", categoria: "city" },
  { contem: ["CG160TITAN"], foto: "cg160-titan", categoria: "city" },
  { contem: ["TITAN"], foto: "cg160-titan", categoria: "city" },
  { contem: ["CG"], foto: "cg160-start", categoria: "city" },

  { contem: ["NXR160"], foto: "nxr160-bros", categoria: "trail" },
  { contem: ["BROS"], foto: "nxr160-bros", categoria: "trail" },
  { contem: ["XRE190"], foto: "xre190", categoria: "trail" },
  { contem: ["SAHARA"], foto: "xre300-sahara", categoria: "trail" },
  { contem: ["TORNADO"], foto: "xr300l-tornado", categoria: "trail" },
  { contem: ["XRE300"], foto: "sahara300-adventure", categoria: "trail" },
  { contem: ["CRF"], foto: "xr300l-tornado-special", categoria: "trail" },

  { contem: ["CB250F"], foto: "cb300f-twister", categoria: "street" },
  { contem: ["CB300F"], foto: "cb300f-twister", categoria: "street" },
  { contem: ["TWISTER"], foto: "cb300f-twister", categoria: "street" },

  { contem: ["CB500HORNET"], foto: "cb500-hornet", categoria: "big" },
  { contem: ["CB500F"], foto: "cb500-hornet", categoria: "big" },
  { contem: ["CB500X"], foto: "nx500", categoria: "big" },
  { contem: ["NX500"], foto: "nx500", categoria: "big" },
  { contem: ["CB750"], foto: "cb750-hornet", categoria: "big" },
  { contem: ["CB650"], foto: "cb650r", categoria: "big" },
  { contem: ["CBR650"], foto: "cb650r", categoria: "big" },
  { contem: ["CBR1000"], foto: "cb650r", categoria: "big" },
  { contem: ["NC750"], foto: "nc750x", categoria: "big" },
  { contem: ["XL750"], foto: "xl750-transalp", categoria: "big" },
  { contem: ["TRANSALP"], foto: "xl750-transalp", categoria: "big" },
  { contem: ["AFRICA"], foto: "xl750-transalp", categoria: "big" },

  { contem: ["TRX420"], foto: "nxr160-bros", categoria: "outros" },
];

export const FOTO_FALLBACK = "/motos/cg160-start.webp";

export interface MotoVisual {
  foto: string;
  categoria: CategoriaId;
  temFotoPropria: boolean;
}

export function visualDoModelo(modelo: string): MotoVisual {
  const n = norm(modelo);
  for (const r of REGRAS) {
    if (r.exceto?.some((e) => n.includes(e))) continue;
    if (r.contem.every((c) => n.includes(c))) {
      return { foto: `/motos/${r.foto}.webp`, categoria: r.categoria, temFotoPropria: true };
    }
  }
  return { foto: FOTO_FALLBACK, categoria: "outros", temFotoPropria: false };
}

/** Nome curto e limpo para exibir no card (sem o intervalo de anos). */
export function nomeCurto(modelo: string) {
  return modelo
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+[Aa]\s*$/g, " ")
    .replace(/[~\-–_/]+\s*$/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[~\-–]$/, "")
    .trim();
}

/** Faixa de anos, extraída do próprio nome do modelo quando existir. */
export function anosDoModelo(modelo: string, periodo: string) {
  const anos = modelo.match(/\b(19|20)\d{2}\b/g);
  if (anos && anos.length >= 2) return `${anos[0]} a ${anos[anos.length - 1]}`;
  if (anos && anos.length === 1) return anos[0];
  return periodo;
}

// ─── MicroWork Cloud ─────────────────────────────────────────────────────────

export const MICROWORK_OS_URL = "https://microworkcloud.com.br/cloud/#/servico/os/inserir";

/**
 * Monta a URL de abertura de OS no MicroWork Cloud já carregando a seleção
 * de moto/revisão. O userscript (menu + autofill) lê estes parâmetros de
 * `location.search`, e dispara o preenchimento assim que a placa/chassi do
 * veículo for informada na tela.
 */
export function urlOrdemServico(opts: {
  modelo: string;
  revisao?: number;
  kmMeses?: string;
  tipo?: "revisao" | "troca_oleo";
}) {
  const p = new URLSearchParams();
  p.set("am_modelo", opts.modelo);
  if (opts.tipo === "troca_oleo") p.set("am_tipo", "troca_oleo");
  if (opts.revisao) p.set("am_rev", String(opts.revisao));
  if (opts.kmMeses) p.set("am_km", opts.kmMeses);
  p.set("am_auto", "1");
  return `https://microworkcloud.com.br/cloud/?${p.toString()}#/servico/os/inserir`;
}
