import { ImageUploadZone } from "@/components/image-upload-zone"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-end mb-8">
          <ThemeToggle />
        </div>

        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-balance mb-6 text-foreground tracking-tight">Image Compression</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
            Professional image optimization with intelligent compression algorithms.
            <span className="block mt-2">Reduce file sizes while preserving visual excellence.</span>
          </p>
        </div>

        {/* Upload Zone */}
        <ImageUploadZone />

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center p-8 rounded-lg bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Smart Compression</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Reduces file size by 30-70% while keeping images sharp and clear
            </p>
          </div>

          <div className="text-center p-8 rounded-lg bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Batch Processing</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Compress up to 20 images at once with automatic queue management
            </p>
          </div>

          <div className="text-center p-8 rounded-lg bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Privacy First</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All processing happens in your browser. Files auto-delete after 1 hour
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
