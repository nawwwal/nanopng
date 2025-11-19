/**
 * Floyd-Steinberg Error Diffusion Dithering
 * Applied selectively to smooth regions only
 */

import { Color } from "./color-quantization"

/**
 * Detect if a region is smooth (suitable for dithering)
 * Returns true if the region has low variance
 */
function isSmoothRegion(imageData: ImageData, x: number, y: number, windowSize = 3): boolean {
  const { width, height, data } = imageData
  const halfWindow = Math.floor(windowSize / 2)

  let sumR = 0,
    sumG = 0,
    sumB = 0
  let count = 0

  // Calculate mean color in window
  for (let dy = -halfWindow; dy <= halfWindow; dy++) {
    for (let dx = -halfWindow; dx <= halfWindow; dx++) {
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = (ny * width + nx) * 4
        sumR += data[idx]
        sumG += data[idx + 1]
        sumB += data[idx + 2]
        count++
      }
    }
  }

  const meanR = sumR / count
  const meanG = sumG / count
  const meanB = sumB / count

  // Calculate variance
  let variance = 0
  for (let dy = -halfWindow; dy <= halfWindow; dy++) {
    for (let dx = -halfWindow; dx <= halfWindow; dx++) {
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = (ny * width + nx) * 4
        const dr = data[idx] - meanR
        const dg = data[idx + 1] - meanG
        const db = data[idx + 2] - meanB
        variance += dr * dr + dg * dg + db * db
      }
    }
  }

  variance /= count

  // Low variance = smooth region
  return variance < 500 // Threshold for "smooth"
}

/**
 * Apply Floyd-Steinberg dithering selectively
 * Only dithers smooth regions to avoid adding noise to textured areas
 */
export function applySelectiveDithering(
  imageData: ImageData,
  palette: Color[],
  findNearestColor: (color: Color, palette: Color[]) => number,
): ImageData {
  const { width, height, data } = imageData
  const output = new ImageData(width, height)
  const outputData = output.data

  // Copy original data
  for (let i = 0; i < data.length; i++) {
    outputData[i] = data[i]
  }

  // Error buffer for current and next row
  const errorBuffer: number[][] = Array.from({ length: 2 }, () => Array.from({ length: width * 4 }, () => 0))

  for (let y = 0; y < height; y++) {
    const currentRow = y % 2
    const nextRow = (y + 1) % 2

    // Clear next row error buffer
    errorBuffer[nextRow].fill(0)

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      // Add accumulated error
      const r = Math.max(0, Math.min(255, outputData[idx] + errorBuffer[currentRow][x * 4]))
      const g = Math.max(0, Math.min(255, outputData[idx + 1] + errorBuffer[currentRow][x * 4 + 1]))
      const b = Math.max(0, Math.min(255, outputData[idx + 2] + errorBuffer[currentRow][x * 4 + 2]))
      const a = outputData[idx + 3]

      // Find nearest palette color
      const nearestIdx = findNearestColor({ r, g, b, a, count: 1 }, palette)
      const paletteColor = palette[nearestIdx]

      // Set quantized color
      outputData[idx] = paletteColor.r
      outputData[idx + 1] = paletteColor.g
      outputData[idx + 2] = paletteColor.b
      outputData[idx + 3] = paletteColor.a

      // Calculate quantization error
      const errR = r - paletteColor.r
      const errG = g - paletteColor.g
      const errB = b - paletteColor.b

      // Only diffuse error in smooth regions
      if (isSmoothRegion(imageData, x, y)) {
        // Distribute error using Floyd-Steinberg weights
        // Right pixel (7/16)
        if (x + 1 < width) {
          errorBuffer[currentRow][(x + 1) * 4] += (errR * 7) / 16
          errorBuffer[currentRow][(x + 1) * 4 + 1] += (errG * 7) / 16
          errorBuffer[currentRow][(x + 1) * 4 + 2] += (errB * 7) / 16
        }

        // Bottom-left pixel (3/16)
        if (x - 1 >= 0) {
          errorBuffer[nextRow][(x - 1) * 4] += (errR * 3) / 16
          errorBuffer[nextRow][(x - 1) * 4 + 1] += (errG * 3) / 16
          errorBuffer[nextRow][(x - 1) * 4 + 2] += (errB * 3) / 16
        }

        // Bottom pixel (5/16)
        errorBuffer[nextRow][x * 4] += (errR * 5) / 16
        errorBuffer[nextRow][x * 4 + 1] += (errG * 5) / 16
        errorBuffer[nextRow][x * 4 + 2] += (errB * 5) / 16

        // Bottom-right pixel (1/16)
        if (x + 1 < width) {
          errorBuffer[nextRow][(x + 1) * 4] += errR / 16
          errorBuffer[nextRow][(x + 1) * 4 + 1] += errG / 16
          errorBuffer[nextRow][(x + 1) * 4 + 2] += errB / 16
        }
      }
    }
  }

  return output
}

