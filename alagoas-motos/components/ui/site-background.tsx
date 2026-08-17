"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/theme-provider";
import Velaris from "@/components/ui/velaris";

const LIGHT_COLORS = ["#fff8f8", "#ffd2d5", "#e51e2a", "#5e0007"];
const DARK_COLORS = ["#22080c", "#8d111b", "#ef2935", "#020204"];

export function SiteBackground({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <div className="site-ambient-root">
      <Velaris
        bg={dark ? "#070709" : "#f7f7f8"}
        colors={dark ? DARK_COLORS : LIGHT_COLORS}
        speed={0.62}
        grain={dark ? 0.16 : 0.1}
        height="100dvh"
        className="site-ambient-canvas"
      />
      <div className="site-ambient-content">{children}</div>
    </div>
  );
}
