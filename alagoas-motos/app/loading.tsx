import { Component as LumaSpin } from '@/components/ui/luma-spin'

export default function Loading() {
  return (
    <div className="app-route-loading" role="status" aria-live="polite" aria-label="Carregando painel">
      <LumaSpin />
      <span className="sr-only">Carregando painel…</span>
    </div>
  )
}
