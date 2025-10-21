"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ImageAnalyzer } from "@/components/image-analyzer"
import type { CompressedImage } from "@/types/image"

interface CompressionResultCardProps {
  image: CompressedImage
}

export function CompressionResultCard({ image }: CompressionResultCardProps) {
  const [showAnalyzer, setShowAnalyzer] = useState(false)
  // </CHANGE>

  const handleDownload = () => {
    const a = document.createElement("a")
    a.href = image.blobUrl
    const fileExtension = image.format === "jpeg" ? "jpg" : image.format
    a.download = `compressed-${image.originalName.replace(/\.[^/.]+$/, "")}.${fileExtension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  if (image.status === "queued") {
    return (
      <Card className="p-5 border-0 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">{image.originalName}</p>
              <p className="text-sm text-accent">Queued for compression...</p>
            </div>
          </div>
        </div>
      </Card>
    )
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
      <Card className="p-5 border-0 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl">
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
      <Card className="p-5 border-0 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl">
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
    <Card className="overflow-hidden border-0 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-300 rounded-2xl">
      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            {/* </CHANGE> */}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium truncate text-foreground">{image.originalName}</p>
                {wasConverted && (
                  <Badge variant="secondary" className="text-xs rounded-lg">
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

            <div className="flex-shrink-0">
              <div className="bg-[var(--chart-2)]/15 text-[var(--chart-2)] px-4 py-1.5 rounded-full text-sm font-semibold">
                -{image.savings.toFixed(1)}%
              </div>
            </div>
            {/* </CHANGE> */}
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <Button onClick={() => setShowAnalyzer(!showAnalyzer)} size="sm" variant="outline" className="rounded-xl">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              {showAnalyzer ? "Hide" : "Analyze"}
            </Button>
            <Button onClick={handleDownload} size="sm" className="rounded-xl">
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
          {/* </CHANGE> */}
        </div>
      </div>

      {showAnalyzer && (
        <div className="border-t border-border/50 bg-muted/20 p-5">
          <ImageAnalyzer image={image} />
        </div>
      )}
    </Card>
  )
}
