"use client"

import { useState } from "react"
import { ImageAnalyzer } from "@/components/image-analyzer"
import type { CompressedImage, ImageFormat } from "@/types/image"
import { cn } from "@/lib/utils"

interface CompressionResultCardProps {
  image: CompressedImage
  onFormatChange?: (imageId: string, format: ImageFormat) => void
}

const FORMAT_OPTIONS: { value: ImageFormat; label: string }[] = [
  { value: "avif", label: "AVIF" },
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
]

// Format file size contextually (B, KB, MB, GB)
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function CompressionResultCard({ image, onFormatChange }: CompressionResultCardProps) {
  const [showAnalyzer, setShowAnalyzer] = useState(false)
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false)

  const handleDownload = () => {
    if (!image.blobUrl && !image.originalBlobUrl) return

    const url = image.blobUrl || image.originalBlobUrl
    if (!url) return

    const a = document.createElement("a")
    a.href = url
    const fileExtension = image.format === "jpeg" ? "jpg" : image.format
    a.download = `compressed-${image.originalName.replace(/\.[^/.]+$/, "")}.${fileExtension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleFormatSelect = (format: ImageFormat) => {
    setIsFormatMenuOpen(false)
    if (format !== image.format && onFormatChange) {
      onFormatChange(image.id, format)
    }
  }

  // Status display for non-completed states
  if (image.status !== "completed" && image.status !== "already-optimized") {
    const statusConfig = {
      queued: { text: "QUEUED", bgClass: "bg-secondary" },
      analyzing: { text: "ANALYZING...", bgClass: "bg-secondary animate-pulse" },
      compressing: { text: "COMPRESSING...", bgClass: "bg-accent/30 animate-pulse" },
      error: { text: image.error || "ERROR", bgClass: "bg-destructive/20" }
    }

    const config = statusConfig[image.status] || statusConfig.queued

    return (
      <div className={cn("border-2 border-foreground/30 p-3 sm:p-4", config.bgClass)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 border border-foreground/30 flex items-center justify-center shrink-0 overflow-hidden bg-secondary">
              {image.status === "error" ? (
                <span className="text-destructive font-bold">!</span>
              ) : image.previewUrl ? (
                <img src={image.previewUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-2 h-2 bg-foreground/50 animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{image.originalName}</p>
              <p className={cn(
                "text-xs font-bold uppercase tracking-wider",
                image.status === "error" ? "text-destructive" : "text-muted-foreground"
              )}>
                {config.text}
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-mono shrink-0">
            {formatFileSize(image.originalSize)}
          </div>
        </div>
      </div>
    )
  }

  const isAlreadyOptimized = image.status === "already-optimized"
  const wasConverted = image.originalFormat && image.originalFormat !== image.format

  // Handle card click to toggle analyzer
  const handleCardClick = (e: React.MouseEvent) => {
    // Check if click was on an interactive element
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('[data-interactive]')) {
      return // Don't toggle on button clicks
    }
    setShowAnalyzer(!showAnalyzer)
  }

  return (
    <div
      className="border-2 border-foreground group card-interactive stagger-item"
      onClick={handleCardClick}
    >
      {/* Main Row */}
      <div className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Name + Size Info */}
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
            {/* Status Icon */}
            <div className={cn(
              "w-10 h-10 border-2 flex items-center justify-center shrink-0 font-black text-sm transition-transform group-hover:scale-105",
              isAlreadyOptimized
                ? "border-muted-foreground text-muted-foreground"
                : "border-foreground accent-bg"
            )}>
              {isAlreadyOptimized ? "OK" : `-${Math.round(image.savings)}%`}
            </div>

            {/* Thumbnail */}
            {(image.previewUrl || image.blobUrl) && (
              <div className="w-10 h-10 border border-foreground flex items-center justify-center shrink-0 overflow-hidden bg-secondary transition-transform group-hover:scale-105">
                <img src={image.previewUrl || image.blobUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Text Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm truncate">{image.originalName}</p>
                {wasConverted && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-secondary border border-foreground/30 font-bold uppercase">
                    {image.originalFormat?.toUpperCase()} → {image.format.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5">
                <span className={!isAlreadyOptimized ? "line-through opacity-60" : ""}>
                  {formatFileSize(image.originalSize)}
                </span>
                {!isAlreadyOptimized && (
                  <>
                    <span>→</span>
                    <span className="text-foreground font-bold">{formatFileSize(image.compressedSize)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Format Selector + Actions - All buttons h-8 */}
          <div className="flex items-center gap-2 pl-13 sm:pl-0">
            {/* Format Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsFormatMenuOpen(!isFormatMenuOpen)}
                className={cn(
                  "h-8 px-3 border-2 border-foreground text-xs font-bold uppercase flex items-center gap-1.5 min-w-[80px] justify-between btn-spring",
                  isFormatMenuOpen ? "bg-foreground text-background" : "hover:bg-secondary"
                )}
              >
                <span>{image.format.toUpperCase()}</span>
                <svg className={cn("w-3 h-3 transition-transform duration-200", isFormatMenuOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isFormatMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsFormatMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 border-2 border-foreground bg-background min-w-[100px] dropdown-animate brutalist-shadow-sm">
                    {FORMAT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleFormatSelect(option.value)}
                        className={cn(
                          "w-full px-3 py-2 text-xs font-bold uppercase text-left transition-colors",
                          option.value === image.format
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-secondary"
                        )}
                      >
                        {option.label}
                        {option.value === image.format && " ✓"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Info Button - h-8 */}
            <button
              onClick={() => setShowAnalyzer(!showAnalyzer)}
              className={cn(
                "w-8 h-8 border-2 border-foreground flex items-center justify-center btn-spring",
                showAnalyzer ? "bg-foreground text-background" : "hover:bg-secondary"
              )}
              title="View Details"
            >
              <svg className={cn("w-4 h-4 transition-transform duration-200", showAnalyzer && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Download Button - h-8 */}
            {!isAlreadyOptimized && (
              <button
                onClick={handleDownload}
                className="h-8 px-3 bg-foreground text-background border-2 border-foreground text-xs font-bold uppercase flex items-center justify-center btn-spring hover:brutalist-shadow-sm"
              >
                ↓
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analyzer Panel */}
      {showAnalyzer && (
        <div className="border-t-2 border-foreground bg-secondary/50 p-4 expand-animate">
          <ImageAnalyzer image={image} />
        </div>
      )}
    </div>
  )
}
