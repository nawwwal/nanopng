import { ImageUploadZone } from "@/components/image-upload-zone"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="flex justify-end mb-12">
          <ThemeToggle />
        </div>

        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-balance mb-4 text-foreground tracking-tight">
            Image Compression
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
            Professional image optimization with intelligent compression algorithms
          </p>
        </div>

        <ImageUploadZone />

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="text-center p-8 rounded-2xl bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Unlimited Compression</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              No file size limits. No session limits. Compress as many images as you need
            </p>
          </div>

          <div className="text-center p-8 rounded-2xl bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Advanced Formats</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Support for PNG, JPEG, WebP, and AVIF with automatic format conversion
            </p>
          </div>

          <div className="text-center p-8 rounded-2xl bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Detailed Analytics</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              View compression metrics, quality scores, and format recommendations
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
