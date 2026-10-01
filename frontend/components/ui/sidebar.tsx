"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SidebarLinkItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface SidebarContextProps {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  animate: boolean
}

const SidebarContext = React.createContext<SidebarContextProps | undefined>(
  undefined
)

export function useSidebar() {
  const context = React.useContext(SidebarContext)

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }

  return context
}

export function SidebarProvider({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  animate?: boolean
}) {
  const [openState, setOpenState] = React.useState(false)
  const open = openProp ?? openState
  const setOpen = setOpenProp ?? setOpenState

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function Sidebar({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  animate?: boolean
}) {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  )
}

export function SidebarBody({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      className={cn("flex h-full w-full flex-col bg-card", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function SidebarMobileShell({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { open, setOpen } = useSidebar()

  return (
    <div className="flex h-10 w-full items-center justify-end bg-card px-4 py-4 md:hidden">
      <Menu
        className="h-5 w-5 text-foreground"
        onClick={() => setOpen((value) => !value)}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "fixed inset-0 z-[100] flex h-full w-full flex-col justify-between bg-card p-10",
              className
            )}
          >
            <button
              type="button"
              className="absolute right-10 top-10 z-50 text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SidebarLink({
  link,
  className,
  ...props
}: {
  link: SidebarLinkItem
  className?: string
} & React.ComponentProps<"a">) {
  const { open, animate } = useSidebar()

  return (
    <a
      href={link.href}
      className={cn(
        "group/sidebar flex items-center justify-start gap-2 py-2",
        className
      )}
      {...props}
    >
      {link.icon}
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="!m-0 inline-block whitespace-pre !p-0 text-sm text-foreground transition duration-150 group-hover/sidebar:translate-x-1"
      >
        {link.label}
      </motion.span>
    </a>
  )
}
