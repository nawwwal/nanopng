/**
 * Image Analyzer - Classifies images as photo, graphic, or mixed
 * for optimal compression strategy selection.
 */

export type ImageType = 'photo' | 'graphic' | 'mixed'

export interface ImageAnalysisResult {
  type: ImageType
  uniqueColors: number
  hasHardEdges: boolean
  hasSmoothGradients: boolean
  hasTransparency: boolean
  hasSignificantTransparency: boolean
  solidRegionRatio: number
}

/**
 * Analyzes image characteristics to classify as photo or graphic.
 *
 * Classification rules:
 * - GRAPHIC: < 5,000 unique colors OR hard edges + flat regions
 * - PHOTO: > 50,000 unique colors AND smooth gradients
 * - MIXED: Between thresholds (safer default, uses lossless)
 *
 * @param data - RGBA pixel data as Uint8ClampedArray
 * @param width - Image width
 * @param height - Image height
 * @returns Analysis result with classification
 */
export function analyzeImageType(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): ImageAnalysisResult {
  const totalPixels = width * height

  // Sample pixels for analysis (max 10,000 for performance)
  const sampleSize = Math.min(10000, totalPixels)
  const sampleStep = Math.max(1, Math.floor(totalPixels / sampleSize))
  const actualSampledPixels = Math.ceil(totalPixels / sampleStep)

  // Track unique colors using a Set (hash RGB values)
  const colorSet = new Set<number>()
  let transparentPixels = 0

  for (let i = 0; i < totalPixels; i += sampleStep) {
    const idx = i * 4
    // Defensive bounds check
    if (idx + 3 >= data.length) break

    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const a = data[idx + 3]

    if (a < 255) {
      transparentPixels++
    }

    // Hash RGB to single number for Set storage
    const colorHash = (r << 16) | (g << 8) | b
    colorSet.add(colorHash)
  }

  const rawUniqueColors = colorSet.size

  // Logarithmic scaling: estimate total unique colors from sample
  // Uses diminishing returns model - early samples find many colors, later fewer
  let uniqueColors: number
  if (actualSampledPixels >= totalPixels) {
    // All pixels sampled, use raw count
    uniqueColors = rawUniqueColors
  } else {
    // Scale up using log ratio
    const saturationFactor = Math.log(totalPixels) / Math.log(actualSampledPixels)
    uniqueColors = Math.min(
      Math.round(rawUniqueColors * saturationFactor),
      totalPixels // cap at theoretical max
    )
  }

  // Fix transparency ratio denominator
  const transparencyRatio = transparentPixels / actualSampledPixels
  const hasTransparency = transparencyRatio > 0.01 // >1% transparent
  const hasSignificantTransparency = transparencyRatio > 0.05 // >5% transparent

  // Calculate solid region ratio and edge characteristics
  const { solidRegionRatio, hasHardEdges, hasSmoothGradients } =
    analyzeTexture(data, width, height)

  // Classification
  let type: ImageType

  if (uniqueColors < 5000 || (hasHardEdges && solidRegionRatio > 0.3)) {
    // Low color count or hard edges with flat regions = graphic
    type = 'graphic'
  } else if (uniqueColors > 50000 && hasSmoothGradients) {
    // High color count with smooth gradients = photo
    type = 'photo'
  } else {
    // Everything else = mixed (conservative)
    type = 'mixed'
  }

  return {
    type,
    uniqueColors,
    hasHardEdges,
    hasSmoothGradients,
    hasTransparency,
    hasSignificantTransparency,
    solidRegionRatio
  }
}

/**
 * Analyzes texture characteristics - solid regions, edges, gradients.
 */
function analyzeTexture(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): { solidRegionRatio: number; hasHardEdges: boolean; hasSmoothGradients: boolean } {
  const blockSize = 4
  let solidBlocks = 0
  let totalBlocks = 0
  let hardEdgeCount = 0
  let smoothTransitionCount = 0

  // Clamp to valid range for block analysis
  const maxY = Math.max(0, height - blockSize)
  const maxX = Math.max(0, width - blockSize)

  // Analyze 4x4 blocks for solid regions
  for (let y = 0; y < maxY; y += blockSize) {
    for (let x = 0; x < maxX; x += blockSize) {
      totalBlocks++

      let minR = 255, maxR = 0
      let minG = 255, maxG = 0
      let minB = 255, maxB = 0

      for (let by = 0; by < blockSize; by++) {
        for (let bx = 0; bx < blockSize; bx++) {
          const idx = ((y + by) * width + (x + bx)) * 4
          // Bounds check
          if (idx + 2 >= data.length) continue

          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]

          if (r < minR) minR = r
          if (r > maxR) maxR = r
          if (g < minG) minG = g
          if (g > maxG) maxG = g
          if (b < minB) minB = b
          if (b > maxB) maxB = b
        }
      }

      const variance = (maxR - minR) + (maxG - minG) + (maxB - minB)

      if (variance < 5) {
        solidBlocks++
      }
    }
  }

  // Sample horizontal edges for edge detection
  const edgeSampleStep = Math.max(1, Math.floor(height / 100))

  for (let y = 0; y < height; y += edgeSampleStep) {
    // Stop at width - 2 to ensure nextIdx is valid
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      // Bounds check for idx + 2 and nextIdx + 2
      if (idx + 6 >= data.length) continue

      const prevIdx = idx - 4
      const nextIdx = idx + 4

      // Calculate color difference with neighbors
      const diffPrev = Math.abs(data[idx] - data[prevIdx]) +
                       Math.abs(data[idx + 1] - data[prevIdx + 1]) +
                       Math.abs(data[idx + 2] - data[prevIdx + 2])

      const diffNext = Math.abs(data[idx] - data[nextIdx]) +
                       Math.abs(data[idx + 1] - data[nextIdx + 1]) +
                       Math.abs(data[idx + 2] - data[nextIdx + 2])

      const maxDiff = Math.max(diffPrev, diffNext)

      if (maxDiff > 100) {
        hardEdgeCount++
      } else if (maxDiff > 0 && maxDiff < 30) {
        smoothTransitionCount++
      }
    }
  }

  const solidRegionRatio = totalBlocks > 0 ? solidBlocks / totalBlocks : 0

  // Heuristics for edge/gradient classification
  const sampledWidth = Math.max(1, width - 2)
  const sampledRows = Math.max(1, Math.ceil(height / edgeSampleStep))
  const totalEdgeSamples = sampledWidth * sampledRows

  const edgeRatio = hardEdgeCount / totalEdgeSamples
  const smoothRatio = smoothTransitionCount / totalEdgeSamples

  const hasHardEdges = edgeRatio > 0.05 // >5% hard edges
  const hasSmoothGradients = smoothRatio > 0.6 // >60% smooth transitions

  return {
    solidRegionRatio,
    hasHardEdges,
    hasSmoothGradients
  }
}
