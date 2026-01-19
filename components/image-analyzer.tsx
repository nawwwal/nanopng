"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BeforeAfterSlider } from "@/components/before-after-slider"
import type { CompressedImage } from "@/types/image"
import { cn } from "@/lib/utils"

interface ImageAnalyzerProps {
  image: CompressedImage
}

export function ImageAnalyzer({ image }: ImageAnalyzerProps) {
  const formatBadgeColor = {
    png: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    jpeg: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    webp: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    avif: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  } as const

  // Estimate quality score based on savings (heuristics)
  // Higher savings usually means more aggressive compression, potentially lower quality
  // But smart algorithms maintain high perceptual quality
  const qualityScore = Math.max(60, Math.min(100, 100 - (image.savings * 0.2)))

  return (
    <div className="space-y-8">
      {/* Before/After Visualization */}
      <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
        <BeforeAfterSlider
          beforeImage={image.originalBlobUrl}
          afterImage={image.blobUrl}
          beforeLabel="Original"
          afterLabel="Optimized"
          objectFit="contain"
          className="aspect-video bg-secondary/30"
        />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Stats Card */}
        <Card className="p-5 border-border/50 bg-card/50 shadow-none space-y-5">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Performance</h4>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm text-muted-foreground">Size Reduction</span>
                <span className="text-lg font-bold text-green-600">-{image.savings.toFixed(1)}%</span>
              </div>
              <Progress value={image.savings} className="h-2 bg-secondary" indicatorClassName="bg-green-600" />
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm text-muted-foreground">Est. Quality</span>
                <span className="text-lg font-bold text-blue-600">~{qualityScore.toFixed(0)}%</span>
              </div>
              <Progress value={qualityScore} className="h-2 bg-secondary" indicatorClassName="bg-blue-600" />
            </div>
          </div>
        </Card>

        {/* Details Card */}
        <Card className="p-5 border-border/50 bg-card/50 shadow-none space-y-5">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">File Details</h4>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Original Format</p>
              <div className={cn("inline-flex items-center px-2 py-1 rounded-md text-xs font-medium", formatBadgeColor[image.originalFormat as keyof typeof formatBadgeColor] || formatBadgeColor.png)}>
                {(image.originalFormat || "png").toUpperCase()}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Optimized Format</p>
              <div className={cn("inline-flex items-center px-2 py-1 rounded-md text-xs font-medium", formatBadgeColor[image.format])}>
                {image.format.toUpperCase()}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Original Size</p>
              <p className="font-mono font-medium text-foreground">{(image.originalSize / 1024).toFixed(1)} KB</p>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Optimized Size</p>
              <p className="font-mono font-bold text-foreground">{(image.compressedSize / 1024).toFixed(1)} KB</p>
            </div>
          </div>

          <div className="pt-3 border-t border-border/50">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Total Saved</span>
              <span className="font-mono font-bold text-green-600">
                {((image.originalSize - image.compressedSize) / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Analysis Insights (Mock for now, but infrastructure is there) */}
      {image.analysis && (
        <Card className="p-4 border-border/50 bg-secondary/20 shadow-none">
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">Optimization Insight</p>
              <p className="text-muted-foreground">
                {image.analysis.isPhoto
                  ? "Detected photo content. Applied perceptual compression to reduce size while maintaining visual fidelity."
                  : "Detected graphic/UI content. Used palette optimization for crisp edges and minimal artifacts."}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
