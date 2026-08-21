"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion"
import { cn } from "@/lib/utils"

export interface DockTabItem {
  id: string
  name: string
  icon: ReactNode
  color: string
}

interface DockTabsProps {
  items: DockTabItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
  ariaLabel?: string
}

function DockIcon({
  item,
  active,
  mouseX,
  canHover,
  reduceMotion,
  onSelect,
}: {
  item: DockTabItem
  active: boolean
  mouseX: MotionValue<number>
  canHover: boolean
  reduceMotion: boolean | null
  onSelect: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const distance = useTransform(mouseX, (value) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return Number.POSITIVE_INFINITY
    return value - bounds.left - bounds.width / 2
  })
  const sizeSync = useTransform(distance, [-140, 0, 140], [50, 76, 50])
  const size = useSpring(sizeSync, { mass: 0.12, stiffness: 190, damping: 16 })
  const animatedSize = canHover && !reduceMotion ? size : 50

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={item.name}
      aria-current={active ? "page" : undefined}
      title={!canHover ? item.name : undefined}
      style={{ width: animatedSize, height: animatedSize }}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      className="relative flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
    >
      <motion.span
        aria-hidden="true"
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/15 text-white shadow-[0_12px_28px_-14px_rgba(0,0,0,.85)]"
        style={{ background: item.color }}
        animate={{ y: canHover && isHovered && !reduceMotion ? -7 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 19 }}
      >
        <motion.span
          className="relative z-10 flex [&>svg]:h-[45%] [&>svg]:w-[45%]"
          animate={{ scale: canHover && isHovered && !reduceMotion ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
        >
          {item.icon}
        </motion.span>
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-white/[.04] to-black/20" />
      </motion.span>

      {canHover && (
        <motion.span
          initial={false}
          animate={{
            opacity: isHovered ? 1 : 0,
            y: isHovered ? -10 : 3,
            scale: isHovered ? 1 : 0.9,
          }}
          className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#151515]/95 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-xl backdrop-blur-xl"
        >
          {item.name}
        </motion.span>
      )}

      <motion.span
        aria-hidden="true"
        className="absolute -bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--brand-primary)]"
        animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.35 }}
      />
    </motion.button>
  )
}

export function DockTabs({
  items,
  activeId,
  onChange,
  className,
  ariaLabel = "Navegação do painel administrativo",
}: DockTabsProps) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY)
  const reduceMotion = useReducedMotion()
  const [canHover, setCanHover] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)")
    const update = () => setCanHover(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-3"
      style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <motion.nav
        aria-label={ariaLabel}
        onMouseMove={canHover ? (event) => mouseX.set(event.clientX) : undefined}
        onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
        className={cn(
          "pointer-events-auto flex max-w-full items-end gap-2 rounded-[26px] border border-white/15 bg-[#111214]/90 px-3 pb-3 pt-2.5 shadow-[0_24px_65px_-22px_rgba(0,0,0,.9)] backdrop-blur-2xl sm:gap-3 sm:px-4",
          className,
        )}
        style={{ overflowX: "auto", scrollbarWidth: "none" }}
        initial={reduceMotion ? false : { y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.08 }}
      >
        {items.map((item) => (
          <DockIcon
            key={item.id}
            item={item}
            active={activeId === item.id}
            mouseX={mouseX}
            canHover={canHover}
            reduceMotion={reduceMotion}
            onSelect={() => onChange(item.id)}
          />
        ))}
      </motion.nav>
    </div>
  )
}
