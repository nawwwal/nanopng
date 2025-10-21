interface CompressionResult {
  compressedBlob: Blob
  originalSize: number
  compressedSize: number
  format: string
}

interface ImageAnalysis {
  isPhoto: boolean
  hasTransparency: boolean
  complexity: number // 0-1, higher = more complex
  dominantColors: number
}

async function analyzeImage(file: File, img: HTMLImageElement): Promise<ImageAnalysis> {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })

  if (!ctx) {
    return {
      isPhoto: file.type === "image/jpeg",
      hasTransparency: file.type === "image/png",
      complexity: 0.5,
      dominantColors: 256,
    }
  }

  // Sample the image at lower resolution for analysis
  const sampleSize = 100
  canvas.width = sampleSize
  canvas.height = sampleSize
  ctx.drawImage(img, 0, 0, sampleSize, sampleSize)

  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
  const data = imageData.data

  // Analyze color distribution
  const colorMap = new Map<string, number>()
  let hasTransparency = false
  let totalVariance = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    if (a < 255) hasTransparency = true

    // Quantize colors to reduce map size
    const colorKey = `${Math.floor(r / 16)},${Math.floor(g / 16)},${Math.floor(b / 16)}`
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1)

    // Calculate local variance (complexity indicator)
    if (i > 0) {
      const prevR = data[i - 4]
      const prevG = data[i - 3]
      const prevB = data[i - 2]
      totalVariance += Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB)
    }
  }

  const uniqueColors = colorMap.size
  const avgVariance = totalVariance / (data.length / 4)
  const complexity = Math.min(avgVariance / 100, 1) // Normalize to 0-1

  // Heuristics for photo detection
  const isPhoto =
    file.type === "image/jpeg" || // JPEGs are usually photos
    (uniqueColors > 1000 && complexity > 0.3) || // High color count + complexity = photo
    (file.size > 200 * 1024 && uniqueColors > 500) // Large file with many colors

  return {
    isPhoto,
    hasTransparency,
    complexity,
    dominantColors: uniqueColors,
  }
}

function getSmartQuality(analysis: ImageAnalysis, format: string): number {
  if (format === "webp") {
    // WebP has better compression, can use slightly lower quality
    if (analysis.isPhoto) {
      return analysis.complexity > 0.6 ? 0.82 : 0.78
    }
    return 0.88
  }

  if (format === "jpeg") {
    // JPEG: maintain quality above 75% to avoid visible artifacts
    if (analysis.complexity > 0.7) {
      return 0.82 // Complex images need higher quality
    }
    if (analysis.complexity > 0.4) {
      return 0.78
    }
    return 0.75 // Minimum 75% quality to prevent blur
  }

  return 1.0
}

async function tryCompressionStrategy(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

export async function compressImageInBrowser(
  file: File,
  targetFormat?: "png" | "jpeg" | "webp",
): Promise<CompressionResult> {
  console.log("[v0] Starting compression for", file.name)
  const originalSize = file.size

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { willReadFrequently: false })

    if (!ctx) {
      reject(new Error("Could not get canvas context"))
      return
    }

    img.onload = async () => {
      canvas.width = img.width
      canvas.height = img.height

      // Analyze image characteristics
      const analysis = await analyzeImage(file, img)

      const strategies: Array<{
        mimeType: string
        quality: number
        format: string
      }> = []

      // Strategy selection based on image analysis
      if (analysis.isPhoto) {
        // Photos: prioritize WebP and JPEG
        strategies.push({
          mimeType: "image/webp",
          quality: getSmartQuality(analysis, "webp"),
          format: "webp",
        })
        strategies.push({
          mimeType: "image/jpeg",
          quality: getSmartQuality(analysis, "jpeg"),
          format: "jpeg",
        })
      } else {
        // Graphics: try WebP, then JPEG if no transparency
        if (!analysis.hasTransparency) {
          strategies.push({
            mimeType: "image/webp",
            quality: 0.88,
            format: "webp",
          })
          strategies.push({
            mimeType: "image/jpeg",
            quality: 0.85,
            format: "jpeg",
          })
        } else {
          // Has transparency: only WebP or keep as PNG
          strategies.push({
            mimeType: "image/webp",
            quality: 0.92,
            format: "webp",
          })
        }
      }

      let bestBlob: Blob | null = null
      let bestSize = originalSize
      let bestFormat = file.type.split("/")[1]

      // Try each strategy and pick the best result
      for (const strategy of strategies) {
        try {
          const blob = await tryCompressionStrategy(img, canvas, ctx, strategy.mimeType, strategy.quality)

          if (blob && blob.size < bestSize) {
            bestBlob = blob
            bestSize = blob.size
            bestFormat = strategy.format
          }
        } catch (error) {
          console.warn("[v0] Strategy failed:", strategy, error)
        }
      }

      // Only return if we achieved meaningful compression (at least 10% reduction)
      if (!bestBlob || bestSize >= originalSize * 0.9) {
        reject(new Error("Could not achieve meaningful compression"))
        return
      }

      console.log("[v0] Compressed", file.name, ":", originalSize, "→", bestSize, "bytes")

      resolve({
        compressedBlob: bestBlob,
        originalSize,
        compressedSize: bestSize,
        format: bestFormat,
      })
    }

    img.onerror = () => {
      reject(new Error("Failed to load image"))
    }

    img.src = URL.createObjectURL(file)
  })
}
