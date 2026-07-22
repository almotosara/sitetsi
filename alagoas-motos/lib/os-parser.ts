import * as XLSX from "xlsx";
import type { OSLinha } from "./os-types";

function parseMoney(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/R\$\s*/g, "").trim();
  // pt-BR: 1.471,10
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function parseDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const dt = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0)));
      return dt.toISOString();
    }
  }
  const s = String(v).trim();
  // dd/MM/yyyy HH:mm:ss
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, d, mo, y, h = "0", mi = "0", se = "0"] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)).toISOString();
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? "" : dt.toISOString();
}

export async function parseOSFile(file: File): Promise<OSLinha[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });

  // Detect header row: first row containing "Emissão"
  let headerIdx = -1;
  let cols: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i];
    const idx = r.findIndex((c: any) => String(c).trim().toLowerCase() === "emissão");
    if (idx >= 0) {
      headerIdx = i;
      r.forEach((c: any, j: number) => {
        const key = String(c).trim();
        if (key) cols[key] = j;
      });
      break;
    }
  }
  if (headerIdx === -1) throw new Error("Cabeçalho 'Emissão' não encontrado.");

  const get = (r: any[], name: string) => {
    const idx = cols[name];
    return idx == null ? "" : r[idx];
  };

  const result: OSLinha[] = [];
  let empresa = "";
  let consultor = "";

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c: any) => c === "" || c == null)) continue;

    // Detect grouping rows: check any cell for "Empresa:" / "Consultor:"
    const joined = r.map((c: any) => String(c ?? "")).join(" | ");
    const mEmp = joined.match(/Empresa:\s*([^|]+)/i);
    const mCons = joined.match(/Consultor:\s*([^|]+)/i);
    if (mCons) {
      consultor = mCons[1].trim();
      continue;
    }
    if (mEmp) {
      empresa = mEmp[1].trim();
      continue;
    }

    const emissao = parseDate(get(r, "Emissão"));
    const numero = String(get(r, "Nº O.S.") ?? "").trim();
    const situacao = String(get(r, "Situação") ?? "").trim();

    // Skip subtotal/total lines (no emissao/numero/situacao)
    if (!emissao && !numero && !situacao) continue;
    if (!numero) continue;

    result.push({
      emissao,
      numero_os: numero,
      situacao,
      tipo_os: String(get(r, "Tipo O.S.") ?? "").trim(),
      pessoa: String(get(r, "Pessoa") ?? "").trim(),
      modelo: String(get(r, "Modelo") ?? "").trim(),
      placa: String(get(r, "Placa") ?? "").trim(),
      total_desconto: parseMoney(get(r, "Total Desconto")),
      total_servico: parseMoney(get(r, "Total Serviço")),
      total_acrescimo: parseMoney(get(r, "Total Acréscimo")),
      total_mercadoria: parseMoney(get(r, "Total Mercadoria")),
      valor_total: parseMoney(get(r, "Valor Total")),
      empresa,
      consultor,
    });
  }

  return result;
}
