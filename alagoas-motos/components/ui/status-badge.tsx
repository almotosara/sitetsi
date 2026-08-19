import type { HTMLAttributes, ReactNode } from "react"
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock5,
  ScanSearch,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type StatusBadgeVariant =
  | "pending"
  | "failed"
  | "success"
  | "progress"
  | "review"
  | "expired"
  | "submitted"
  | "neutral"

const ICONS: Record<StatusBadgeVariant, LucideIcon> = {
  pending: TriangleAlert,
  failed: CircleX,
  success: CircleCheck,
  progress: CircleDashed,
  review: ScanSearch,
  expired: Clock5,
  submitted: Clock5,
  neutral: CircleDashed,
}

const EXACT_VARIANTS: Record<string, StatusBadgeVariant> = {
  novo: "pending",
  agendado: "pending",
  pendente: "pending",
  aguardando: "pending",
  "em contato": "progress",
  "em andamento": "progress",
  aberta: "progress",
  "em execucao": "progress",
  confirmado: "review",
  atencao: "review",
  "em analise": "review",
  "proposta enviada": "submitted",
  enviado: "submitted",
  reenviado: "submitted",
  submetido: "submitted",
  convertido: "success",
  concluida: "success",
  finalizada: "success",
  sucesso: "success",
  "meta atingida": "success",
  recebido: "success",
  os: "success",
  perdido: "failed",
  falhou: "failed",
  cancelado: "failed",
  cancelada: "failed",
  critico: "failed",
  erro: "failed",
  "nao compareceu": "failed",
  ausente: "failed",
  expirado: "expired",
  expirada: "expired",
  vencido: "expired",
  vencida: "expired",
  parada: "expired",
}

function normalizeStatus(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function getStatusBadgeVariant(status: string): StatusBadgeVariant {
  const normalized = normalizeStatus(status)
  const exact = EXACT_VARIANTS[normalized]
  if (exact) return exact

  if (/nao comparec|cancel|falh|perdid|critic|erro|recus/.test(normalized)) return "failed"
  if (/conclu|convert|finaliz|recebid|atendid|meta ating|sucesso/.test(normalized)) return "success"
  if (/expir|vencid|parad|encerr/.test(normalized)) return "expired"
  if (/proposta|enviad|reenviad|submetid/.test(normalized)) return "submitted"
  if (/confirm|revis|analise|atencao/.test(normalized)) return "review"
  if (/contato|andamento|execucao|abert|process/.test(normalized)) return "progress"
  if (/pendent|novo|agend|aguard/.test(normalized)) return "pending"
  return "neutral"
}

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: string
  variant?: StatusBadgeVariant
  size?: "sm" | "md"
  surface?: "auto" | "dark"
  showIcon?: boolean
  children?: ReactNode
}

export function StatusBadge({
  status = "",
  variant,
  size = "md",
  surface = "auto",
  showIcon = true,
  children,
  className,
  ...props
}: StatusBadgeProps) {
  const tone = variant ?? getStatusBadgeVariant(status)
  const Icon = ICONS[tone]
  const content = children ?? (status || "—")

  return (
    <span
      data-tone={tone}
      data-size={size}
      data-surface={surface}
      className={cn("status-badge-ui", className)}
      {...props}
    >
      {showIcon && <Icon aria-hidden="true" strokeWidth={2.7} />}
      <span>{content}</span>
    </span>
  )
}

export default StatusBadge
