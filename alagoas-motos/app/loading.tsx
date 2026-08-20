export default function Loading() {
  return (
    <div className="app-route-loading" role="status" aria-live="polite" aria-label="Carregando painel">
      <div className="app-route-loading-mark">
        <img src="/alagoas-motos-symbol.webp" width={64} height={64} alt="" aria-hidden="true" />
      </div>
      <strong>Alagoas Motos</strong>
      <span>Carregando painel…</span>
    </div>
  )
}
