"use client"

import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react"
import { flushSync } from "react-dom"
import { Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

export type TransitionVariant =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "rectangle"
  | "star"

interface AnimatedThemeTogglerProps extends ComponentPropsWithoutRef<"button"> {
  duration?: number
  variant?: TransitionVariant
  fromCenter?: boolean
}

function polygonCollapsed(cx: number, cy: number, vertexCount: number): string {
  const pairs = Array.from({ length: vertexCount }, () => `${cx}px ${cy}px`).join(", ")
  return `polygon(${pairs})`
}

function getThemeTransitionClipPaths(
  variant: TransitionVariant,
  cx: number,
  cy: number,
  maxRadius: number,
  viewportWidth: number,
  viewportHeight: number
): [string, string] {
  switch (variant) {
    case "circle":
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxRadius}px at ${cx}px ${cy}px)`,
      ]
    case "square": {
      const halfW = Math.max(cx, viewportWidth - cx)
      const halfH = Math.max(cy, viewportHeight - cy)
      const halfSide = Math.max(halfW, halfH) * 1.05
      const end = [
        `${cx - halfSide}px ${cy - halfSide}px`,
        `${cx + halfSide}px ${cy - halfSide}px`,
        `${cx + halfSide}px ${cy + halfSide}px`,
        `${cx - halfSide}px ${cy + halfSide}px`,
      ].join(", ")
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`]
    }
    case "triangle": {
      const scale = maxRadius * 2.2
      const dx = (Math.sqrt(3) / 2) * scale
      const verts = [
        `${cx}px ${cy - scale}px`,
        `${cx + dx}px ${cy + 0.5 * scale}px`,
        `${cx - dx}px ${cy + 0.5 * scale}px`,
      ].join(", ")
      return [polygonCollapsed(cx, cy, 3), `polygon(${verts})`]
    }
    case "diamond": {
      const radius = maxRadius * Math.SQRT2
      const end = [
        `${cx}px ${cy - radius}px`,
        `${cx + radius}px ${cy}px`,
        `${cx}px ${cy + radius}px`,
        `${cx - radius}px ${cy}px`,
      ].join(", ")
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`]
    }
    case "hexagon": {
      const radius = maxRadius * Math.SQRT2
      const verts: string[] = []
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 3
        verts.push(`${cx + radius * Math.cos(angle)}px ${cy + radius * Math.sin(angle)}px`)
      }
      return [polygonCollapsed(cx, cy, 6), `polygon(${verts.join(", ")})`]
    }
    case "rectangle": {
      const halfW = Math.max(cx, viewportWidth - cx)
      const halfH = Math.max(cy, viewportHeight - cy)
      const end = [
        `${cx - halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy - halfH}px`,
        `${cx + halfW}px ${cy + halfH}px`,
        `${cx - halfW}px ${cy + halfH}px`,
      ].join(", ")
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`]
    }
    case "star": {
      const radius = maxRadius * Math.SQRT2 * 1.03
      const innerRatio = 0.42
      const starPolygon = (currentRadius: number) => {
        const verts: string[] = []
        for (let i = 0; i < 5; i++) {
          const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
          verts.push(
            `${cx + currentRadius * Math.cos(outerAngle)}px ${cy + currentRadius * Math.sin(outerAngle)}px`
          )
          const innerAngle = outerAngle + Math.PI / 5
          verts.push(
            `${cx + currentRadius * innerRatio * Math.cos(innerAngle)}px ${cy + currentRadius * innerRatio * Math.sin(innerAngle)}px`
          )
        }
        return `polygon(${verts.join(", ")})`
      }
      const startRadius = Math.max(2, radius * 0.025)
      return [starPolygon(startRadius), starPolygon(radius)]
    }
    default:
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxRadius}px at ${cx}px ${cy}px)`,
      ]
  }
}

export function AnimatedThemeToggler({
  className,
  duration = 400,
  variant,
  fromCenter = false,
  ...props
}: AnimatedThemeTogglerProps) {
  const shape = variant ?? "circle"
  const [isDark, setIsDark] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"))
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  const toggleTheme = useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const { top, left, width, height } = button.getBoundingClientRect()
    const x = fromCenter ? viewportWidth / 2 : left + width / 2
    const y = fromCenter ? viewportHeight / 2 : top + height / 2
    const maxRadius = Math.hypot(
      Math.max(x, viewportWidth - x),
      Math.max(y, viewportHeight - y)
    )

    const applyTheme = () => {
      const newThemeIsDark = !isDark
      setIsDark(newThemeIsDark)
      document.documentElement.classList.toggle("dark", newThemeIsDark)
      localStorage.setItem("theme", newThemeIsDark ? "dark" : "light")
    }

    if (typeof document.startViewTransition !== "function") {
      applyTheme()
      return
    }

    const clipPath = getThemeTransitionClipPaths(
      shape,
      x,
      y,
      maxRadius,
      viewportWidth,
      viewportHeight
    )
    const root = document.documentElement
    root.dataset.magicuiThemeVt = "active"
    root.style.setProperty("--magicui-theme-toggle-vt-duration", `${duration}ms`)
    root.style.setProperty("--magicui-theme-vt-clip-from", clipPath[0])

    const cleanup = () => {
      delete root.dataset.magicuiThemeVt
      root.style.removeProperty("--magicui-theme-toggle-vt-duration")
      root.style.removeProperty("--magicui-theme-vt-clip-from")
    }

    const transition = document.startViewTransition(() => {
      flushSync(applyTheme)
    })
    transition.finished?.finally(cleanup)

    transition.ready?.then(() => {
      document.documentElement.animate(
        { clipPath },
        {
          duration,
          easing: shape === "star" ? "linear" : "ease-in-out",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        }
      )
    })
  }, [duration, fromCenter, isDark, shape])

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
