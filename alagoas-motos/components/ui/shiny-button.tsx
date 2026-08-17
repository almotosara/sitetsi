"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface ShinyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  size?: "compact" | "default" | "wide"
}

export function ShinyButton({
  children,
  className,
  size = "default",
  type = "button",
  ...props
}: ShinyButtonProps) {
  return (
    <button
      type={type}
      className={cn("shiny-cta", `shiny-cta-${size}`, className)}
      {...props}
    >
      <span className="shiny-cta-content">{children}</span>
    </button>
  )
}
