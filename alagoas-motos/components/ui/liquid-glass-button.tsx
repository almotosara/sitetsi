"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const liquidbuttonVariants = cva(
  "inline-flex items-center transition-colors justify-center cursor-pointer gap-2 whitespace-nowrap rounded-md text-sm font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-transparent hover:scale-[1.02] duration-300 transition text-on-media",
        brand: "bg-transparent hover:scale-[1.02] duration-300 transition text-on-media",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 text-xs gap-1.5 px-4",
        lg: "h-10 rounded-md px-6",
        xl: "h-12 rounded-md px-8",
        xxl: "h-14 rounded-md px-10",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "xxl",
    },
  },
);

function LiquidButton({
  className,
  variant,
  size,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof liquidbuttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <>
      <Comp
        data-slot="liquid-button"
        className={cn(
          "relative isolate overflow-hidden",
          liquidbuttonVariants({ variant, size, className }),
        )}
        {...props}
      >
        {/* refraction layer */}
        <span
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
          style={{ backdropFilter: "url(#liquid-glass-filter) blur(6px) saturate(150%)" }}
        />
        {/* tint + specular highlights */}
        <span className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-white/10" />
        <span className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.55),inset_0_-1px_0_0_rgba(255,255,255,0.18),inset_0_0_0_1px_rgba(255,255,255,0.22),0_10px_30px_-12px_rgba(0,0,0,0.6)]" />
        <span className="relative flex items-center justify-center gap-2">{children}</span>
      </Comp>
      <GlassFilter />
    </>
  );
}

function GlassFilter() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
      <defs>
        <filter id="liquid-glass-filter" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.001 0.005"
            numOctaves="1"
            seed="17"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="80"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

export { LiquidButton, liquidbuttonVariants, GlassFilter };
