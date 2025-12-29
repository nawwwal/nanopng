import { ImageUploadZone } from "@/components/image-upload-zone"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-background font-sans selection:bg-primary/10 selection:text-primary">
      {/* Navbar */}
      <nav className="border-b border-border/40 sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-6xl">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
               </svg>
            </div>
            NanoPNG
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="outline" size="sm" className="rounded-full px-4 hidden sm:flex">
              GitHub
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-16 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-16 space-y-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-balance text-foreground tracking-tight">
            Intelligent image optimization <br className="hidden sm:block"/> for the modern web.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed font-normal">
            Compress PNG, JPEG, and WebP images locally in your browser. 
            No server uploads, no limits, completely private.
          </p>
        </div>

        {/* Main Action Area */}
        <div className="mb-24">
           <ImageUploadZone />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 max-w-4xl mx-auto border-t border-border pt-16">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground">100% Private & Local</h3>
            <p className="text-muted-foreground leading-relaxed">
              Your images never leave your device. All processing happens directly in your browser using advanced WebAssembly and Canvas APIs.
            </p>
          </div>

          <div className="space-y-4">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground">Smart Compression</h3>
            <p className="text-muted-foreground leading-relaxed">
              Automatically detects photos vs graphics to apply the best strategy: distinct color quantization for logos, perceptual compression for photos.
            </p>
          </div>

          <div className="space-y-4">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground">Blazing Fast</h3>
            <p className="text-muted-foreground leading-relaxed">
              Multithreaded processing queues handle dozens of images simultaneously without freezing your browser.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
