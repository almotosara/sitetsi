'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import Image from 'next/image'

import {
  CircularProgress,
  CircularProgressIndicator,
  CircularProgressRange,
  CircularProgressTrack,
} from '@/components/ui/circular-progress'

export function AppleLoading() {
  const [show, setShow] = useState(true)
  const [progress, setProgress] = useState(6)

  useEffect(() => {
    const startedAt = performance.now()
    const duration = 850
    let frame = 0

    const update = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      setProgress(Math.round(6 + eased * 94))
      if (elapsed < 1) frame = requestAnimationFrame(update)
    }

    frame = requestAnimationFrame(update)
    const timer = window.setTimeout(() => setShow(false), 1080)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#080909] px-6"
          role="status"
          aria-live="polite"
          aria-label="Carregando Alagoas Motos"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(239,68,68,.16),transparent_22rem)]" />
          <motion.div
            initial={{ y: 10, scale: .96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: .38, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col items-center text-center"
            style={{ fontFamily: "'SUSE Local', var(--font-inter), Inter, sans-serif" }}
          >
            <CircularProgress value={progress} size={112} thickness={3.5} label="Progresso de carregamento">
              <CircularProgressIndicator className="drop-shadow-[0_0_14px_rgba(239,68,68,.3)]">
                <CircularProgressTrack className="text-white/10" />
                <CircularProgressRange className="text-[#ef4444]" />
              </CircularProgressIndicator>
              <div className="absolute inset-[15px] grid place-items-center overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_18px_45px_-22px_rgba(239,68,68,.9)]">
                <Image
                  src="/alagoas-motos-symbol.webp"
                  alt="Alagoas Motos"
                  width={66}
                  height={66}
                  priority
                  className="h-[66px] w-[66px] object-contain"
                />
              </div>
            </CircularProgress>

            <strong className="mt-5 text-[15px] font-bold tracking-[-0.02em] text-[#f5f5f2]">Alagoas Motos</strong>
            <span className="mt-1 text-[11px] font-medium tracking-[0.08em] text-[#777974]">CARREGANDO PAINEL · {progress}%</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
