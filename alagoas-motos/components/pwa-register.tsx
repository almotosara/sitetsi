'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return

    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    const id = window.setTimeout(register, 1200)

    return () => {
      window.clearTimeout(id)
    }
  }, [])

  return null
}
