"use client"

import { BeforeAfterSlider } from "@/components/before-after-slider"
import type { CompressedImage } from "@/types/image"

interface ImageAnalyzerProps {
  image: CompressedImage
}

export function ImageAnalyzer({ image }: ImageAnalyzerProps) {
  // Estimate quality score based on savings
  const qualityScore = Math.max(60, Math.min(100, 100 - (image.savings * 0.2))) 

  return (
    <div className="space-y-6">
      {/* Before/After Visualization */}
      <div className="border-2 border-foreground overflow-hidden">
        <BeforeAfterSlider
          beforeImage={image.originalBlobUrl}
          afterImage={image.blobUrl}
          beforeLabel="Original"
          afterLabel="Optimized"
        />
      </div>

      {/* Metrics Grid - Brutalist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Performance Stats */}
        <div className="border-2 border-foreground p-4 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider border-b-2 border-foreground pb-2">Performance</h4>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs uppercase font-bold text-muted-foreground">Size Reduction</span>
                <span className="text-lg font-black accent-text">-{image.savings.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-secondary border border-foreground/30">
                <div 
                  className="h-full bg-accent" 
                  style={{ width: `${Math.min(100, image.savings)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs uppercase font-bold text-muted-foreground">Est. Quality</span>
                <span className="text-lg font-black">~{qualityScore.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-secondary border border-foreground/30">
                <div 
                  className="h-full bg-foreground" 
                  style={{ width: `${qualityScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* File Details */}
        <div className="border-2 border-foreground p-4 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider border-b-2 border-foreground pb-2">File Details</h4>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Original</p>
              <p className="font-mono font-bold px-2 py-1 bg-secondary inline-block">
                {(image.originalFormat || "png").toUpperCase()}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Optimized</p>
              <p className="font-mono font-bold px-2 py-1 accent-bg inline-block">
                {image.format.toUpperCase()}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Original Size</p>
              <p className="font-mono font-bold">{(image.originalSize / 1024).toFixed(1)} KB</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Optimized Size</p>
              <p className="font-mono font-bold">{(image.compressedSize / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          
          <div className="pt-3 border-t-2 border-foreground/30">
            <div className="flex justify-between items-center text-xs">
              <span className="uppercase font-bold text-muted-foreground">Total Saved</span>
              <span className="font-mono font-black accent-text">
                {((image.originalSize - image.compressedSize) / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Analysis Insights */}
      {image.analysis && (
        <div className="border-2 border-foreground p-4 bg-secondary/30">
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 border-2 border-foreground flex items-center justify-center font-black text-xs">
              i
            </div>
            <div className="text-sm">
              <p className="font-bold uppercase mb-1">Optimization Strategy</p>
              <p className="text-muted-foreground">
                {image.analysis.isPhoto 
                  ? "Photo detected → Applied perceptual compression to reduce size while maintaining visual fidelity." 
                  : "Graphic/UI detected → Used palette optimization for crisp edges and minimal artifacts."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
