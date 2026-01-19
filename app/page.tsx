"use client"

import { EditorProvider } from "@/components/editor"
import { EditorLayoutInner } from "@/components/editor/editor-layout"
import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/logo"
import { ExportButton } from "@/components/export-button"
import Link from "next/link"

export default function Home() {
  return (
    <EditorProvider>
      <main className="min-h-screen bg-background font-mono selection:bg-accent selection:text-accent-foreground">
        {/* Brutalist Navbar */}
        <nav className="border-b-2 border-foreground sticky top-0 bg-background z-50">
          <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between max-w-7xl">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity uppercase">
              <Logo />
              NanoPNG
            </Link>
            <div className="flex items-center gap-3">
              <ExportButton />
              <ThemeToggle />
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub (opens in new tab)"
                className="h-9 px-3 border-2 border-foreground text-foreground text-xs font-bold uppercase flex items-center justify-center btn-spring hover:bg-foreground hover:text-background"
              >
                GitHub
              </a>
            </div>
          </div>
        </nav>

        {/* Main Editor */}
        <EditorLayoutInner />

        {/* Footer */}
        <footer className="border-t-2 border-foreground py-6 bg-background">
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Built for people who value their privacy.
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              NANOPNG © {new Date().getFullYear()}
            </div>
          </div>
        </footer>
      </main>
    </EditorProvider>
  )
}
