"use client"

import { EditorProvider } from "@/components/editor"
import { EditorLayoutInner } from "@/components/editor/editor-layout"
import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/logo"
import { ExportButton } from "@/components/export-button"
import Link from "next/link"

// ... imports
// Removed ExportButton import if unused elsewhere, but keeping it if needed or just remove usage.

export default function Home() {
  return (
    <EditorProvider>
      <main className="h-[100dvh] flex flex-col overflow-hidden bg-background font-mono selection:bg-accent selection:text-accent-foreground">
        {/* Brutalist Navbar */}
        <nav className="border-b border-foreground bg-background z-50 shrink-0">
          <div className="px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity uppercase">
              <Logo />
              NanoPNG
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub (opens in new tab)"
                className="h-9 px-3 border border-foreground text-foreground text-xs font-bold uppercase flex items-center justify-center btn-spring hover:bg-foreground hover:text-background"
              >
                GitHub
              </a>
            </div>
          </div>
        </nav>

        {/* Main Editor */}
        <div className="flex-1 overflow-hidden relative min-h-0">
          <EditorLayoutInner />
        </div>

        {/* Footer */}
        <footer className="border-t border-foreground py-2 bg-background shrink-0 z-50 text-[10px] sm:text-xs">
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl flex items-center justify-between gap-4">
            <div className="text-muted-foreground uppercase tracking-wide">
              Built for privacy. Runs locally.
            </div>
            <div className="text-muted-foreground font-mono">
              NANOPNG © {new Date().getFullYear()}
            </div>
          </div>
        </footer>
      </main>
    </EditorProvider>
  )
}
