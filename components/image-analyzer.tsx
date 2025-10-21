"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BeforeAfterSlider } from "@/components/before-after-slider"
import type { CompressedImage } from "@/types/image"

interface ImageAnalyzerProps {
  image: CompressedImage
}

export function ImageAnalyzer({ image }: ImageAnalyzerProps) {
  const formatBadgeColor = {
    png: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    jpeg: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    webp: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    avif: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  }

  const qualityScore = Math.max(0, Math.min(100, 100 - image.savings))
  const compressionScore = Math.min(100, image.savings)

  return (
    <div className="space-y-6">
      <BeforeAfterSlider
        beforeImage={image.originalBlobUrl}
        afterImage={image.blobUrl}
        beforeLabel="Original"
        afterLabel="Compressed"
      />

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Compression Metrics</h3>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">File Size Reduction</span>
              <span className="font-semibold text-[var(--chart-2)]">{image.savings.toFixed(1)}%</span>
            </div>
            <Progress value={image.savings} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Quality Preservation</span>
              <span className="font-semibold">{qualityScore.toFixed(0)}%</span>
            </div>
            <Progress value={qualityScore} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Compression Efficiency</span>
              <span className="font-semibold">{compressionScore.toFixed(0)}%</span>
            </div>
            <Progress value={compressionScore} className="h-2" />
          </div>

          <div className="pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original Format</span>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${formatBadgeColor[image.originalFormat || "png"]}`}
              >
                {(image.originalFormat || "png").toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Compressed Format</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${formatBadgeColor[image.format]}`}>
                {image.format.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original Size</span>
              <span className="font-medium">{(image.originalSize / 1024).toFixed(2)} KB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Compressed Size</span>
              <span className="font-medium">{(image.compressedSize / 1024).toFixed(2)} KB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bytes Saved</span>
              <span className="font-medium text-[var(--chart-2)]">
                {((image.originalSize - image.compressedSize) / 1024).toFixed(2)} KB
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
