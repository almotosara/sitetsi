'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ToastMessage { id: number; msg: string; err?: boolean }

const ToastCtx = createContext<(msg: string, err?: boolean) => void>(() => {})

export function useToast() { return useContext(ToastCtx) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const show = useCallback((msg: string, err?: boolean) => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, err }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="toast-anim pointer-events-auto min-w-[220px] rounded-[9px] border px-4 py-3 text-sm"
            style={{
              background: 'var(--toast-bg)',
              borderColor: 'var(--border-line)',
              borderLeftColor: t.err ? '#ff5a5f' : '#2fd675',
              borderLeftWidth: 3,
              color: 'var(--text-primary)',
              boxShadow: '0 10px 30px -12px var(--shadow-medium)',
            }}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}