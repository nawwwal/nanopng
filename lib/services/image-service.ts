import { CompressedImage, ImageAnalysis } from "@/types/image"
import { buildHistogram, medianCut, kmeansRefinement, findNearestColor } from "@/lib/core/color-quantization"
import { applySelectiveDithering } from "@/lib/core/floyd-steinberg"

export class ImageService {
  /**
   * Analyze an image to determine its characteristics and best compression strategy
   */
  static async analyze(file: File): Promise<ImageAnalysis> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          // Use a small sample size for analysis to be fast
          const sampleSize = Math.min(img.width, 100)
          const scale = sampleSize / img.width
          canvas.width = sampleSize
          canvas.height = img.height * scale

          const ctx = canvas.getContext("2d", { willReadFrequently: true })
          if (!ctx) {
            URL.revokeObjectURL(objectUrl)
            throw new Error("Could not get canvas context")
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data

          // Analysis variables
          const colorSet = new Set<string>()
          let hasTransparency = false
          let totalVariance = 0

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const a = data[i + 3]

            if (a < 255) hasTransparency = true

            // Quantize colors more aggressively for analysis (4-bit color) to detect photos vs graphics
            const colorKey = `${r & 0xf0},${g & 0xf0},${b & 0xf0}`
            colorSet.add(colorKey)

            if (i >= 4) {
              const prevR = data[i - 4]
              const prevG = data[i - 3]
              const prevB = data[i - 2]
              totalVariance += Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB)
            }
          }

          const uniqueColors = colorSet.size
          const avgVariance = totalVariance / (data.length / 4) / 3 // Normalized variance per channel
          const complexity = Math.min(avgVariance / 20, 1) // Normalize 0-1 (20 is empirical threshold for high complexity)

          const isPhoto =
            file.type === "image/jpeg" ||
            file.type === "image/heic" ||
            (uniqueColors > 500 && complexity > 0.2) ||
            complexity > 0.5

          // Determine suggested format
          let suggestedFormat: "png" | "jpeg" | "webp" | "avif" = "webp"
          
          // If it's a photo, WebP or JPEG is usually best
          // If it's a simple graphic with few colors, PNG or WebP-lossless might be better
          // But broadly, WebP is the safest default for modern browsers
          
          URL.revokeObjectURL(objectUrl)

          resolve({
            isPhoto,
            hasTransparency,
            complexity,
            uniqueColors,
            suggestedFormat
          })
        } catch (error) {
          URL.revokeObjectURL(objectUrl)
          reject(error)
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error("Failed to load image for analysis"))
      }

      img.src = objectUrl
    })
  }

  /**
   * Compress an image using the best local strategy
   */
  static async compress(
    file: File, 
    id: string,
    analysis?: ImageAnalysis
  ): Promise<CompressedImage> {
    const originalSize = file.size
    
    // If no analysis provided, run it first
    const imgAnalysis = analysis || await this.analyze(file)

    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = img.width
          canvas.height = img.height
          
          const ctx = canvas.getContext("2d", { willReadFrequently: true })
          if (!ctx) throw new Error("Could not get canvas context")

          // Enable high-quality rendering
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = "high"
          ctx.drawImage(img, 0, 0)

          let bestBlob: Blob | null = null
          let bestSize = originalSize
          let bestFormat = file.type.split("/")[1] as "png" | "jpeg" | "webp" | "avif"
          // default to input format if something goes wrong, but we usually switch to webp/jpeg/png

          // Strategy 1: Advanced Quantization for PNGs (Graphics)
          if (imgAnalysis.hasTransparency && !imgAnalysis.isPhoto && imgAnalysis.uniqueColors > 256) {
            // Clone canvas for quantization to avoid dirtying the main one if we need to retry
             // Actually we can just draw on the main one since we redraw for other strategies or use toBlob
             // But for quantization we modify pixel data directly.
             
             const qCanvas = document.createElement("canvas")
             qCanvas.width = img.width
             qCanvas.height = img.height
             const qCtx = qCanvas.getContext("2d")
             if (qCtx) {
                qCtx.drawImage(img, 0, 0)
                await this.quantizeImage(qCanvas, qCtx, 256)
                const blob = await new Promise<Blob | null>(r => qCanvas.toBlob(r, "image/png"))
                if (blob && blob.size < bestSize) {
                  bestBlob = blob
                  bestSize = blob.size
                  bestFormat = "png"
                }
             }
          }

          // Strategy 2: WebP (The workhorse)
          // Adjust quality based on complexity
          const webpQuality = imgAnalysis.isPhoto 
            ? (imgAnalysis.complexity > 0.5 ? 0.82 : 0.85) 
            : 0.90
            
          const webpBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/webp", webpQuality))
          if (webpBlob && webpBlob.size < bestSize) {
            bestBlob = webpBlob
            bestSize = webpBlob.size
            bestFormat = "webp"
          }

          // Strategy 3: JPEG (Photos, no transparency)
          if (imgAnalysis.isPhoto && !imgAnalysis.hasTransparency) {
            const jpegQuality = 0.85
            const jpegBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", jpegQuality))
            
            // Only prefer JPEG if it beats WebP significantly (unlikely) or if user asked for it (not implemented yet)
            // But we strictly want the smallest size here
            if (jpegBlob && jpegBlob.size < bestSize) {
              bestBlob = jpegBlob
              bestSize = jpegBlob.size
              bestFormat = "jpeg"
            }
          }

          URL.revokeObjectURL(objectUrl)

          // Check if we actually optimized anything
          let status: "completed" | "already-optimized" = "completed"
          const savings = ((originalSize - bestSize) / originalSize) * 100
          
          // If savings are negligible (< 5%) or size increased, consider it already optimized
          // We keep the compressed version if it is smaller, even by a bit, but we mark it differently?
          // The plan says: If savings < 2%, mark as ALREADY_OPTIMIZED.
          
          if (savings < 2 || !bestBlob) {
             status = "already-optimized"
             // If we didn't find a smaller blob, we just return the original
             if (!bestBlob || bestSize >= originalSize) {
                bestBlob = file // Just return the original file object as blob
                bestSize = originalSize
             }
          }

          resolve({
            id,
            originalName: file.name,
            originalSize,
            compressedSize: bestSize,
            compressedBlob: bestBlob,
            blobUrl: URL.createObjectURL(bestBlob),
            originalBlobUrl: URL.createObjectURL(file),
            savings: Math.max(0, savings),
            format: bestFormat,
            originalFormat: file.type.split("/")[1] as any,
            status,
            analysis: imgAnalysis
          })

        } catch (error) {
          URL.revokeObjectURL(objectUrl)
          reject(error)
        }
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error("Failed to load image for compression"))
      }

      img.src = objectUrl
    })
  }

  /**
   * Helper to quantize image (private-ish)
   */
  private static async quantizeImage(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, maxColors = 256): Promise<void> {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // 1. Build Histogram
    const histogram = buildHistogram(imageData)
    if (histogram.length <= maxColors) return // Already low color count

    // 2. Median Cut
    let palette = medianCut(histogram, maxColors)

    // 3. K-Means Refinement
    palette = kmeansRefinement(histogram, palette, 3) // 3 iterations usually enough

    // 4. Dithering
    const dithered = applySelectiveDithering(imageData, palette, findNearestColor)
    
    ctx.putImageData(dithered, 0, 0)
  }
}

