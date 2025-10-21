"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CompressedImage } from "@/types/image"

interface CompressionResultCardProps {
  image: CompressedImage
}

export function CompressionResultCard({ image }: CompressionResultCardProps) {
  const handleDownload = async () => {
    try {
      const response = await fetch(image.compressedUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `compressed-${image.originalName}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Download failed:", error)
      alert("Failed to download image")
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  if (image.status === "uploading") {
    return (
      <Card className="p-4 border-accent/30 bg-accent/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <p className="font-medium">{image.originalName}</p>
              <p className="text-sm text-accent">Uploading...</p>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (image.status === "processing") {
    return (
      <Card className="p-4 border-accent/30 bg-accent/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{image.originalName}</p>
              <p className="text-sm text-accent">Compressing...</p>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (image.status === "error") {
    return (
      <Card className="p-4 border-destructive/50 bg-destructive/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="font-medium">{image.originalName}</p>
              <p className="text-sm text-destructive">{image.error}</p>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const wasConverted = image.originalFormat && image.originalFormat !== image.format

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium truncate">{image.originalName}</p>
              {wasConverted && (
                <Badge variant="secondary" className="text-xs">
                  {image.originalFormat?.toUpperCase()} → {image.format.toUpperCase()}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatFileSize(image.originalSize)}</span>
              <span>→</span>
              <span className="text-foreground font-medium">{formatFileSize(image.compressedSize)}</span>
            </div>
          </div>

          {/* Savings Badge */}
          <div className="flex-shrink-0">
            <div className="bg-[var(--chart-2)]/20 text-[var(--chart-2)] px-3 py-1 rounded-full text-sm font-semibold">
              -{image.savings.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Download Button */}
        <Button onClick={handleDownload} size="sm" className="flex-shrink-0">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download
        </Button>
      </div>
    </Card>
  )
}
