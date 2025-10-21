/**
 * Advanced Image Processor implementing TinyPNG-like algorithms
 * Includes color quantization, k-means refinement, and selective dithering
 */

import { buildHistogram, medianCut, kmeansRefinement, findNearestColor } from "./color-quantization"
import { applySelectiveDithering } from "./floyd-steinberg"

interface CompressionResult {
  compressedBlob: Blob
  originalSize: number
  compressedSize: number
  format: string
}

interface ImageAnalysis {
  isPhoto: boolean
  hasTransparency: boolean
  complexity: number
  uniqueColors: number
}

async function analyzeImage(imageData: ImageData): Promise<ImageAnalysis> {
  const data = imageData.data
  const colorSet = new Set<string>()
  let hasTransparency = false
  let totalVariance = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    if (a < 255) hasTransparency = true

    // Track unique colors (quantized to reduce set size)
    colorSet.add(`${Math.floor(r / 4)},${Math.floor(g / 4)},${Math.floor(b / 4)}`)

    if (i >= 4) {
      const prevR = data[i - 4]
      const prevG = data[i - 3]
      const prevB = data[i - 2]
      totalVariance += Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB)
    }
  }

  const uniqueColors = colorSet.size
  const avgVariance = totalVariance / ((data.length / 4) * 3) // Divide by 3 for RGB channels
  const complexity = Math.min(avgVariance / 255, 1) // Normalize to 0-1 range

  const isPhoto = uniqueColors > 1000 || complexity > 0.15

  return {
    isPhoto,
    hasTransparency,
    complexity,
    uniqueColors,
  }
}

/**
 * Apply color quantization to reduce image to 256 colors
 */
async function quantizeImage(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, maxColors = 256): Promise<void> {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  console.log("[v0] Building color histogram...")
  const histogram = buildHistogram(imageData)

  if (histogram.length <= maxColors) {
    console.log("[v0] Image already has", histogram.length, "colors, skipping quantization")
    return
  }

  console.log("[v0] Applying median cut to reduce", histogram.length, "colors to", maxColors)
  let palette = medianCut(histogram, maxColors)

  console.log("[v0] Refining palette with k-means...")
  palette = kmeansRefinement(histogram, palette, 5)

  console.log("[v0] Applying selective Floyd-Steinberg dithering...")
  const dithered = applySelectiveDithering(imageData, palette, findNearestColor)

  ctx.putImageData(dithered, 0, 0)
}

/**
 * Compress image using TinyPNG-like algorithms
 */
export async function compressImageAdvanced(file: File): Promise<CompressionResult> {
  console.log("[v0] Starting advanced compression for", file.name)
  const originalSize = file.size

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d", { willReadFrequently: true })

        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }

        canvas.width = img.width
        canvas.height = img.height

        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(img, 0, 0)

        // Analyze image
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const analysis = await analyzeImage(imageData)

        const isJpeg =
          file.type === "image/jpeg" ||
          file.name.toLowerCase().endsWith(".jpg") ||
          file.name.toLowerCase().endsWith(".jpeg")
        if (isJpeg) {
          analysis.isPhoto = true
        }

        console.log("[v0] Image analysis:", analysis)

        let bestBlob: Blob | null = null
        let bestSize = originalSize
        let bestFormat = file.type.split("/")[1] || "png"

        // Strategy 1: For PNG with many colors, apply quantization
        if (file.type === "image/png" && analysis.uniqueColors > 256 && !analysis.isPhoto) {
          console.log("[v0] Applying color quantization...")
          await quantizeImage(canvas, ctx, 256)

          // Try PNG with quantization
          const pngBlob = await new Promise<Blob | null>((res) => {
            canvas.toBlob((blob) => res(blob), "image/png", 1.0)
          })

          if (pngBlob && pngBlob.size < bestSize) {
            bestBlob = pngBlob
            bestSize = pngBlob.size
            bestFormat = "png"
            console.log("[v0] Quantized PNG:", bestSize, "bytes")
          }
        }

        // Strategy 2: Try WebP (best compression for most images)
        const webpQuality = analysis.isPhoto ? 0.85 : 0.9
        const webpBlob = await new Promise<Blob | null>((res) => {
          canvas.toBlob((blob) => res(blob), "image/webp", webpQuality)
        })

        if (webpBlob && webpBlob.size < bestSize) {
          bestBlob = webpBlob
          bestSize = webpBlob.size
          bestFormat = "webp"
          console.log("[v0] WebP:", bestSize, "bytes")
        }

        // Strategy 3: Try JPEG for photos without transparency
        if (analysis.isPhoto && !analysis.hasTransparency) {
          const jpegQuality = 0.85
          const jpegBlob = await new Promise<Blob | null>((res) => {
            canvas.toBlob((blob) => res(blob), "image/jpeg", jpegQuality)
          })

          if (jpegBlob && jpegBlob.size < bestSize) {
            bestBlob = jpegBlob
            bestSize = jpegBlob.size
            bestFormat = "jpeg"
            console.log("[v0] JPEG:", bestSize, "bytes")
          }
        }

        if (!bestBlob || bestSize >= originalSize) {
          console.log("[v0] No compression achieved, returning original file")
          resolve({
            compressedBlob: file,
            originalSize,
            compressedSize: originalSize,
            format: file.type.split("/")[1] || "png",
          })
          return
        }

        const savings = ((originalSize - bestSize) / originalSize) * 100
        console.log(
          "[v0] Compressed",
          file.name,
          ":",
          originalSize,
          "→",
          bestSize,
          "bytes (",
          savings.toFixed(1),
          "% reduction)",
        )

        resolve({
          compressedBlob: bestBlob,
          originalSize,
          compressedSize: bestSize,
          format: bestFormat,
        })
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = URL.createObjectURL(file)
  })
}
