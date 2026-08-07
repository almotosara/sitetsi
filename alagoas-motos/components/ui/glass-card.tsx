"use client";

import { cn } from "@/lib/utils";
import { GlassFilter } from "@/components/ui/liquid-glass-button";

function GlassCard({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card"
      className={cn("liquid-glass relative isolate flex flex-col gap-6 py-7", className)}
      {...props}
    >
      <span aria-hidden="true" className="liquid-glass-refraction" />
      <span aria-hidden="true" className="liquid-glass-sheen" />
      <div className="relative flex flex-col gap-6">{children}</div>
      <GlassFilter />
    </div>
  );
}

function GlassCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1.5 px-7 has-data-[slot=glass-card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}

function GlassCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card-title"
      className={cn("text-xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function GlassCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function GlassCardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function GlassCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="glass-card-content" className={cn("px-7", className)} {...props} />;
}

function GlassCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn("flex flex-col gap-3 px-7", className)}
      {...props}
    />
  );
}

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardAction,
  GlassCardContent,
  GlassCardFooter,
};
