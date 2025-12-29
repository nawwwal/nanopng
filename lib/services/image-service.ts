import { CompressedImage, ImageAnalysis } from "@/types/image"
import { buildHistogram, medianCut, kmeansRefinement, findNearestColor } from "@/lib/core/color-quantization"
import { applySelectiveDithering } from "@/lib/core/floyd-steinberg"
import { canEncodeAvif } from "@/lib/core/format-capabilities"

export class ImageService {
  /**
   * Calculate the ratio of solid (uniform color) regions in the image
   * Graphics typically have 20-80% solid regions, photos have 0-5%
   */
  private static calculateSolidRegionRatio(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): number {
    const blockSize = 4
    let solidBlocks = 0
    let totalBlocks = 0

    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        totalBlocks++
        
        // Sample pixels in this block
        let minR = 255, maxR = 0
        let minG = 255, maxG = 0
        let minB = 255, maxB = 0

        for (let by = 0; by < blockSize; by++) {
          for (let bx = 0; bx < blockSize; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]

            minR = Math.min(minR, r)
            maxR = Math.max(maxR, r)
            minG = Math.min(minG, g)
            maxG = Math.max(maxG, g)
            minB = Math.min(minB, b)
            maxB = Math.max(maxB, b)
          }
        }

        // Block is solid if max color difference < 5
        const colorDiff = (maxR - minR) + (maxG - minG) + (maxB - minB)
        if (colorDiff < 5) {
          solidBlocks++
        }
      }
    }

    return totalBlocks > 0 ? solidBlocks / totalBlocks : 0
  }

  /**
   * Calculate the ratio of sharp edges vs gradual transitions
   * Photos have more gradual transitions, graphics have more sharp edges
   */
  private static calculateEdgeSharpnessRatio(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): { sharpEdges: number; gradualTransitions: number; ratio: number } {
    let sharpEdges = 0
    let gradualTransitions = 0
    let totalTransitions = 0

    // Check horizontal transitions
    for (let y = 0; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const idx1 = (y * width + (x - 1)) * 4
        const idx2 = (y * width + x) * 4

        const r1 = data[idx1], g1 = data[idx1 + 1], b1 = data[idx1 + 2]
        const r2 = data[idx2], g2 = data[idx2 + 1], b2 = data[idx2 + 2]

        const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)
        totalTransitions++

        if (diff > 50) {
          sharpEdges++
        } else if (diff < 20) {
          gradualTransitions++
        }
      }
    }

    // Check vertical transitions
    for (let y = 1; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx1 = ((y - 1) * width + x) * 4
        const idx2 = (y * width + x) * 4

        const r1 = data[idx1], g1 = data[idx1 + 1], b1 = data[idx1 + 2]
        const r2 = data[idx2], g2 = data[idx2 + 1], b2 = data[idx2 + 2]

        const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)
        totalTransitions++

        if (diff > 50) {
          sharpEdges++
        } else if (diff < 20) {
          gradualTransitions++
        }
      }
    }

    const ratio = totalTransitions > 0 ? gradualTransitions / totalTransitions : 0
    return { sharpEdges, gradualTransitions, ratio }
  }

  /**
   * Calculate color histogram spread using entropy
   * Photos have smooth/continuous distributions, graphics have spiky distributions
   */
  private static calculateHistogramSpread(data: Uint8ClampedArray): number {
    // Build histogram with 32 bins per channel (coarser for analysis)
    const bins = 32
    const histogram = new Array(bins * bins * bins).fill(0)
    let totalPixels = 0

    for (let i = 0; i < data.length; i += 4) {
      // Clamp bin indices to prevent overflow when pixel value is 255
      const r = Math.min(bins - 1, Math.floor((data[i] / 255) * bins))
      const g = Math.min(bins - 1, Math.floor((data[i + 1] / 255) * bins))
      const b = Math.min(bins - 1, Math.floor((data[i + 2] / 255) * bins))
      
      const binIdx = r * bins * bins + g * bins + b
      histogram[binIdx]++
      totalPixels++
    }

    // Calculate normalized entropy
    let entropy = 0
    for (let i = 0; i < histogram.length; i++) {
      if (histogram[i] > 0) {
        const p = histogram[i] / totalPixels
        entropy -= p * Math.log2(p)
      }
    }

    // Normalize to 0-1 range (max entropy is log2(bins^3))
    const maxEntropy = Math.log2(bins * bins * bins)
    return entropy / maxEntropy
  }

  /**
   * Calculate texture score by analyzing micro-variance in small blocks
   * Photos have consistent non-zero variance, graphics have many zero-variance blocks
   */
  private static calculateTextureScore(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): number {
    const blockSize = 8
    const sampleBlocks = 20 // Sample 20 blocks for performance
    let totalVariance = 0
    let sampledBlocks = 0

    // Use deterministic grid-based sampling for consistent results
    const gridCols = Math.ceil(Math.sqrt(sampleBlocks))
    const gridRows = Math.ceil(sampleBlocks / gridCols)
    const stepX = Math.max(1, Math.floor((width - blockSize) / gridCols))
    const stepY = Math.max(1, Math.floor((height - blockSize) / gridRows))

    for (let i = 0; i < sampleBlocks; i++) {
      const gridX = i % gridCols
      const gridY = Math.floor(i / gridCols)
      const x = Math.min(width - blockSize - 1, gridX * stepX)
      const y = Math.min(height - blockSize - 1, gridY * stepY)

      // Calculate variance within this block
      let sumR = 0, sumG = 0, sumB = 0
      let sumR2 = 0, sumG2 = 0, sumB2 = 0
      let pixelCount = 0

      for (let by = 0; by < blockSize && (y + by) < height; by++) {
        for (let bx = 0; bx < blockSize && (x + bx) < width; bx++) {
          const idx = ((y + by) * width + (x + bx)) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]

          sumR += r
          sumG += g
          sumB += b
          sumR2 += r * r
          sumG2 += g * g
          sumB2 += b * b
          pixelCount++
        }
      }

      if (pixelCount > 0) {
        const meanR = sumR / pixelCount
        const meanG = sumG / pixelCount
        const meanB = sumB / pixelCount

        const varianceR = (sumR2 / pixelCount) - (meanR * meanR)
        const varianceG = (sumG2 / pixelCount) - (meanG * meanG)
        const varianceB = (sumB2 / pixelCount) - (meanB * meanB)

        const avgVariance = (varianceR + varianceG + varianceB) / 3
        totalVariance += avgVariance
        sampledBlocks++
      }
    }

    const avgVariance = sampledBlocks > 0 ? totalVariance / sampledBlocks : 0
    // Normalize: typical photo variance is 50-200, graphics is 0-20
    // Map to 0-1 range where >50 is high (photo-like)
    return Math.min(avgVariance / 100, 1)
  }
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
          // Use a larger sample size for better analysis (increased from 100px to 200px)
          const sampleSize = Math.min(img.width, 200)
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

            // Quantize colors more aggressively for analysis (4-bit color, max 4096 unique values)
            // This is used for photo vs graphic detection, not for actual quantization
            // Note: This differs from buildHistogram() which uses full 8-bit premultiplied colors
            const colorKey = `${r & 0xf0},${g & 0xf0},${b & 0xf0}`
            colorSet.add(colorKey)

            if (i >= 4) {
              const prevR = data[i - 4]
              const prevG = data[i - 3]
              const prevB = data[i - 2]
              totalVariance += Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB)
            }
          }

          // uniqueColors: 4-bit quantized color count (0-4096 range)
          // Used as a heuristic for photo vs graphic detection
          // Note: When comparing against 256 threshold in compression, this is approximate
          // Actual quantization uses buildHistogram() which counts full 8-bit premultiplied colors
          const uniqueColors = colorSet.size
          const avgVariance = totalVariance / (data.length / 4) / 3 // Normalized variance per channel
          const complexity = Math.min(avgVariance / 20, 1) // Normalize 0-1 (20 is empirical threshold for high complexity)

          // Multi-signal scoring system for robust photo detection
          const solidRegionRatio = this.calculateSolidRegionRatio(data, canvas.width, canvas.height)
          const edgeAnalysis = this.calculateEdgeSharpnessRatio(data, canvas.width, canvas.height)
          const histogramSpread = this.calculateHistogramSpread(data)
          const textureScore = this.calculateTextureScore(data, canvas.width, canvas.height)

          // Weighted scoring: each signal contributes to photo likelihood
          // Higher score = more likely to be a photo
          const photoScore =
            (1 - solidRegionRatio) * 0.30 +      // Low solid regions = photo (photos have noise, graphics have flat areas)
            edgeAnalysis.ratio * 0.25 +            // Gradual transitions = photo (smooth gradients, blur)
            histogramSpread * 0.25 +              // Spread histogram = photo (continuous color distribution)
            textureScore * 0.20                    // Consistent texture = photo (camera noise, texture)

          // Threshold tuned for accuracy (0.55 = balanced, can be adjusted)
          const isPhoto = photoScore > 0.55

          // Determine suggested format
          let suggestedFormat: "png" | "jpeg" | "webp" = "webp"
          
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
    analysis?: ImageAnalysis,
    originalFormat?: string
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
          
          // Normalize format string (handle jpg -> jpeg, etc.)
          // Use originalFormat if provided (for decoded HEIC files), otherwise derive from file.type
          const rawFormat = originalFormat || file.type.split("/")[1] || "png"
          const normalizedFormat = rawFormat === "jpg" ? "jpeg" : rawFormat.toLowerCase()
          let bestFormat = normalizedFormat as "png" | "jpeg" | "webp" | "avif"
          // default to input format if something goes wrong, but we usually switch to avif/webp/jpeg/png

          // Determine if quantization should be applied (for all non-photo graphics with high color counts)
          // Note: uniqueColors is 4-bit quantized count (0-4096), threshold of 256 is approximate
          // Actual quantization will use buildHistogram() which counts full 8-bit colors
          const shouldQuantize = !imgAnalysis.isPhoto && imgAnalysis.uniqueColors > 256
          let quantizedCanvas: HTMLCanvasElement | null = null

          // Strategy 1: Advanced Quantization for Graphics (transparent or non-transparent)
          if (shouldQuantize) {
            const qCanvas = document.createElement("canvas")
            qCanvas.width = img.width
            qCanvas.height = img.height
            const qCtx = qCanvas.getContext("2d")
            if (qCtx) {
              qCtx.drawImage(img, 0, 0)
              await this.quantizeImage(qCanvas, qCtx, 256)
              quantizedCanvas = qCanvas // Store for use in other strategies
              
              // Try PNG format (best for quantized graphics, especially with transparency)
              const pngBlob = await new Promise<Blob | null>(r => qCanvas.toBlob(r, "image/png"))
              if (pngBlob && pngBlob.size < bestSize) {
                bestBlob = pngBlob
                bestSize = pngBlob.size
                bestFormat = "png"
              }
            }
          }

          // Use quantized canvas if available, otherwise use original canvas
          const sourceCanvas = quantizedCanvas || canvas

          // Strategy 2: AVIF (Best compression, if supported)
          // AVIF typically achieves 30-50% better compression than WebP
          if (await canEncodeAvif()) {
            const avifQuality = imgAnalysis.isPhoto ? 0.75 : 0.85
            const avifBlob = await new Promise<Blob | null>(r => 
              sourceCanvas.toBlob(r, "image/avif", avifQuality)
            )
            // Verify the blob was created and has the correct MIME type
            if (avifBlob && avifBlob.type === "image/avif" && avifBlob.size < bestSize) {
              bestBlob = avifBlob
              bestSize = avifBlob.size
              bestFormat = "avif"
            }
          }

          // Strategy 3: WebP (The workhorse)
          // Adjust quality based on complexity
          const webpQuality = imgAnalysis.isPhoto 
            ? (imgAnalysis.complexity > 0.5 ? 0.82 : 0.85) 
            : 0.90
            
          const webpBlob = await new Promise<Blob | null>(r => sourceCanvas.toBlob(r, "image/webp", webpQuality))
          if (webpBlob && webpBlob.size < bestSize) {
            bestBlob = webpBlob
            bestSize = webpBlob.size
            bestFormat = "webp"
          }

          // Strategy 4: JPEG (Photos, no transparency)
          if (imgAnalysis.isPhoto && !imgAnalysis.hasTransparency) {
            const jpegQuality = 0.85
            const jpegBlob = await new Promise<Blob | null>(r => sourceCanvas.toBlob(r, "image/jpeg", jpegQuality))
            
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
            originalFormat: (originalFormat || normalizedFormat) as any,
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

