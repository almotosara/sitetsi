"use client"

import { useCallback, useEffect, useState } from "react"
import { BadgeDollarSign, Clock3, RefreshCw } from "lucide-react"
import { useToast } from "@/components/toast"
import styles from "./mao-de-obra-editor.module.css"

type EditableField = "tmo_hora_valor" | "revisao_geral_valor"

interface MaoDeObraRow {
  id: number
  modelos: string
  tmo_hora_valor: number | null
  revisao_geral_valor: number | null
  ordem: number
}

function formatCurrency(value: number | null) {
  if (value == null) return ""
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  })
}

function parseCurrency(value: string) {
  const clean = value.replace(/[^\d,.-]/g, "")
  if (!clean) return null
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function CurrencyInput({
  value,
  disabled,
  label,
  onInvalid,
  onSave,
}: {
  value: number | null
  disabled: boolean
  label: string
  onInvalid: () => void
  onSave: (next: number) => Promise<boolean>
}) {
  const [text, setText] = useState(() => formatCurrency(value))

  useEffect(() => setText(formatCurrency(value)), [value])

  async function commit() {
    const parsed = parseCurrency(text)
    if (parsed == null || parsed < 0) {
      setText(formatCurrency(value))
      onInvalid()
      return
    }
    if (parsed === value) {
      setText(formatCurrency(value))
      return
    }

    const saved = await onSave(parsed)
    setText(formatCurrency(saved ? parsed : value))
  }

  return (
    <input
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          setText(formatCurrency(value))
          event.currentTarget.blur()
        }
      }}
      className={styles.currencyInput}
    />
  )
}

export function MaoDeObraEditor() {
  const toast = useToast()
  const [rows, setRows] = useState<MaoDeObraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingCell, setSavingCell] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch("/api/admin/mao-de-obra", { cache: "no-store" })
      const result = await response.json() as { rows?: MaoDeObraRow[]; error?: string }
      if (!response.ok) throw new Error(result.error || "Falha ao carregar os grupos")
      setRows(result.rows ?? [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Falha ao carregar os grupos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadRows() }, [loadRows])

  async function saveValue(row: MaoDeObraRow, field: EditableField, value: number) {
    if (!Number.isFinite(value) || value < 0) {
      toast("O valor não pode ser negativo.", true)
      return false
    }

    const cell = `${row.id}:${field}`
    setSavingCell(cell)
    try {
      const response = await fetch("/api/admin/mao-de-obra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, field, value }),
      })
      const result = await response.json() as { row?: MaoDeObraRow; error?: string }
      if (!response.ok || !result.row) throw new Error(result.error || "Falha ao salvar")
      setRows((current) => current.map((item) => item.id === row.id ? result.row! : item))
      toast(`Valores de ${row.modelos} atualizados.`)
      return true
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha ao salvar valor", true)
      return false
    } finally {
      setSavingCell(null)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="mao-de-obra-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Tabela operacional</span>
          <h2 id="mao-de-obra-title">Valores de mão de obra por grupo</h2>
          <p>
            Edite os valores usados na oficina. A próxima consulta já recebe os dados atualizados.
          </p>
        </div>
        <button type="button" onClick={() => void loadRows()} disabled={loading} className={styles.refreshButton}>
          <RefreshCw aria-hidden="true" className={loading ? styles.spinning : undefined} />
          Atualizar
        </button>
      </div>

      {loading && (
        <div className={styles.state} role="status">
          <RefreshCw aria-hidden="true" className={styles.spinning} />
          Carregando grupos…
        </div>
      )}

      {!loading && loadError && (
        <div className={styles.errorState} role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadRows()}>Tentar novamente</button>
        </div>
      )}

      {!loading && !loadError && rows.length === 0 && (
        <div className={styles.state}>Nenhum grupo de mão de obra cadastrado.</div>
      )}

      {!loading && !loadError && rows.length > 0 && (
        <div className={styles.grid} role="table" aria-label="Valores de mão de obra">
          <div className={styles.gridHeader} role="row">
            <span role="columnheader">Grupo de modelos</span>
            <span role="columnheader"><Clock3 aria-hidden="true" /> T.M.O hora</span>
            <span role="columnheader"><BadgeDollarSign aria-hidden="true" /> Revisão geral</span>
          </div>
          {rows.map((row) => (
            <div className={styles.gridRow} role="row" key={row.id}>
              <div className={styles.modelCell} role="cell">
                <span className={styles.order}>{String(row.ordem).padStart(2, "0")}</span>
                <strong>{row.modelos}</strong>
              </div>
              <label className={styles.valueCell} role="cell">
                <span>T.M.O hora</span>
                <CurrencyInput
                  value={row.tmo_hora_valor}
                  disabled={savingCell === `${row.id}:tmo_hora_valor`}
                  label={`T.M.O hora do grupo ${row.modelos}`}
                  onInvalid={() => toast("Informe um valor válido e não negativo.", true)}
                  onSave={(value) => saveValue(row, "tmo_hora_valor", value)}
                />
              </label>
              <label className={styles.valueCell} role="cell">
                <span>Revisão geral</span>
                <CurrencyInput
                  value={row.revisao_geral_valor}
                  disabled={savingCell === `${row.id}:revisao_geral_valor`}
                  label={`Revisão geral do grupo ${row.modelos}`}
                  onInvalid={() => toast("Informe um valor válido e não negativo.", true)}
                  onSave={(value) => saveValue(row, "revisao_geral_valor", value)}
                />
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
