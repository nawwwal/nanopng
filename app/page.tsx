import { ImageUploadZone } from "@/components/image-upload-zone"
import { ThemeToggle } from "@/components/theme-toggle"
import { JellySqueeze } from "@/components/jelly-squeeze"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-background font-mono selection:bg-accent selection:text-accent-foreground">
      {/* Brutalist Navbar */}
      <nav className="border-b-2 border-foreground sticky top-0 bg-background z-50">
        <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between max-w-7xl">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity uppercase">
            <div className="w-8 h-8 bg-foreground flex items-center justify-center text-background font-black text-xs">
              N
            </div>
            NanoPNG
          </Link>
          <div className="flex items-center gap-3">
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

      {/* Hero Section - Asymmetric Split with Interactive Demo */}
      <section className="border-b-2 border-foreground lg:bg-[linear-gradient(90deg,var(--background)_50%,var(--secondary)_50%)]">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left: Copy */}
            <div className="p-4 sm:p-8 lg:p-12 border-b-2 lg:border-b-0 lg:border-r-2 border-foreground flex flex-col justify-center">
              <div className="space-y-6">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                  Compress<br />
                  images.<br />
                  <span className="accent-bg inline-block px-2 mt-2">Locally.</span>
                </h1>

                <p className="text-lg sm:text-xl font-bold uppercase tracking-wide text-muted-foreground">
                  No upload. No limits. No bullsh*t.
                </p>

                <div className="pt-4 space-y-3 text-sm sm:text-base">
                  <div className="flex items-start gap-3">
                    <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0">01</span>
                    <span>Your images stay on <strong className="uppercase">your device</strong>. Not on a server. Not in the cloud.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0">02</span>
                    <span>Process 100 images while TinyPNG is still loading its first spinner.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0">03</span>
                    <span>No &ldquo;upgrade to pro for more than 20 images&rdquo; nonsense.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0">04</span>
                    <span>Smart format selection, or <strong className="uppercase">choose your own</strong>. Your call.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Interactive Compression Demo */}
            <div className="p-4 sm:p-8 lg:p-12 bg-secondary lg:bg-transparent flex flex-col justify-center min-h-[400px] lg:min-h-[500px]">
              <JellySqueeze title="↕ Move cursor to compress" />
            </div>
          </div>
        </div>
      </section>

      {/* Upload Zone */}
      <section className="py-8 sm:py-12 lg:py-16">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <ImageUploadZone />
        </div>
      </section>

      {/* How It Works - Brutalist Grid */}
      <section className="border-t-2 border-foreground">
        <div className="container mx-auto max-w-7xl">
          <h2 className="sr-only">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y-2 md:divide-y-0 md:divide-x-2 divide-foreground">
            <div className="p-6 sm:p-8">
              <div className="text-6xl sm:text-7xl font-black mb-4">01</div>
              <h3 className="text-lg font-bold uppercase mb-2">Drop files</h3>
              <p className="text-sm text-muted-foreground">
                Drag & drop, paste from clipboard, or click to browse. PNG, JPEG, WebP, AVIF, HEIC supported.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="text-6xl sm:text-7xl font-black mb-4">02</div>
              <h3 className="text-lg font-bold uppercase mb-2">Auto-optimized</h3>
              <p className="text-sm text-muted-foreground">
                Photos get perceptual compression. Graphics get palette optimization. The right strategy for each image.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="text-6xl sm:text-7xl font-black mb-4">03</div>
              <h3 className="text-lg font-bold uppercase mb-2">Download</h3>
              <p className="text-sm text-muted-foreground">
                Get optimized images instantly. Change formats if needed. Download individually or as a ZIP.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Specs - Raw Data */}
      <section className="border-t-2 border-foreground bg-foreground text-background">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div>
              <div className="text-xs uppercase font-bold opacity-60 mb-1">Processing</div>
              <div className="text-lg font-bold">100% Local</div>
              <div className="text-sm opacity-80">WebAssembly + Canvas API</div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold opacity-60 mb-1">Formats</div>
              <div className="text-lg font-bold">AVIF / WebP / PNG</div>
              <div className="text-sm opacity-80">Auto or manual selection</div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold opacity-60 mb-1">Concurrency</div>
              <div className="text-lg font-bold">5 Parallel</div>
              <div className="text-sm opacity-80">Multi-threaded queue</div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold opacity-60 mb-1">Limits</div>
              <div className="text-lg font-bold">Unlimited</div>
              <div className="text-sm opacity-80">Upload unlimited files with no size limit</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-foreground py-6">
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
  )
}
