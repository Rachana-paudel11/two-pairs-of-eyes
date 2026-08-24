"use client"

import * as React from "react"
import { Play } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PatrolButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
  icon?: React.ReactNode
}

/**
 * PatrolButton - Created specifically for the TechNova "Two Pairs of Eyes" Workplace Safety Simulation.
 * Styled using the project's official palette:
 * - Dark Green (#0A3323 / #061F15)
 * - Moss / Olive Green (#839958 / #4D642D / #3B4E22)
 * - Lime Highlight (#A3E635 / #84CC16)
 * - Beige (#FAF8ED / #F7F4D5)
 */
export function PatrolButton({
  className,
  children = "START PATROL INSPECTION",
  icon = <Play className="h-3.5 w-3.5 fill-current text-white ml-0.5" />,
  ...props
}: PatrolButtonProps) {
  return (
    <button
      className={cn(
        // Base structure & flex layout
        "group relative inline-flex items-center gap-3.5 rounded-full px-6 py-3",
        "font-sans text-sm font-extrabold uppercase tracking-wider text-white",
        "cursor-pointer select-none transition-all duration-300 ease-out",
        // Project Palette Gradient Background (Olive to Dark Moss Green)
        "bg-gradient-to-r from-[#4D642D] via-[#3B4E22] to-[#2D3F1B]",
        // Border & Inner Glow
        "border border-[#A3E635]/40 shadow-[0_10px_30px_rgba(60,85,35,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)]",
        // Hover & Active States
        "hover:from-[#5C7736] hover:via-[#465D28] hover:to-[#384C1F]",
        "hover:border-[#A3E635]/70 hover:shadow-[0_14px_36px_rgba(163,230,53,0.25)] hover:-translate-y-0.5 hover:scale-[1.02]",
        "active:translate-y-0 active:scale-100 active:shadow-md",
        // Disabled state
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      {/* Icon Badge Container */}
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 border border-white/30 transition-transform duration-300 group-hover:scale-110 group-hover:bg-white/25">
        {icon}
      </span>

      {/* Button Text */}
      <span className="relative z-10">{children}</span>
    </button>
  )
}
