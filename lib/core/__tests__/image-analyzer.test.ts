// lib/core/__tests__/image-analyzer.test.ts
import { describe, it, expect } from 'vitest'
import { analyzeImageType } from '../image-analyzer'

describe('analyzeImageType', () => {
  describe('unique colors estimation', () => {
    it('scales up unique color count for large images using logarithmic estimation', () => {
      // Create a large image (1000x1000 = 1M pixels) with diverse colors
      const width = 1000
      const height = 1000
      const data = new Uint8ClampedArray(width * height * 4)

      // Fill with pseudo-random colors to simulate photo-like color diversity
      // Use LCG (Linear Congruential Generator) for deterministic "random" colors
      // This ensures each pixel has a unique color, simulating a real photo
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x
          const idx = i * 4
          // LCG formula: seed = (a * seed + c) mod m
          const seed = ((i * 1103515245 + 12345) >>> 0)
          data[idx] = (seed >> 16) & 0xFF     // R
          data[idx + 1] = (seed >> 8) & 0xFF  // G
          data[idx + 2] = seed & 0xFF         // B
          data[idx + 3] = 255                 // A
        }
      }

      const result = analyzeImageType(data, width, height)

      // With only 10k samples from 1M pixels, raw count would be ~10k
      // Logarithmic scaling should estimate higher (closer to actual unique colors)
      // The saturation factor for 1M/10k = log(1M)/log(10k) ≈ 1.5
      // 10k * 1.5 = 15k, so we expect at least 15000
      expect(result.uniqueColors).toBeGreaterThanOrEqual(15000)
    })

    it('returns raw count for small images where all pixels are sampled', () => {
      // Small image (50x50 = 2500 pixels, all sampled)
      const width = 50
      const height = 50
      const data = new Uint8ClampedArray(width * height * 4)

      // Fill with 100 unique colors
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4
        const colorIndex = i % 100
        data[idx] = colorIndex     // R
        data[idx + 1] = 0          // G
        data[idx + 2] = 0          // B
        data[idx + 3] = 255        // A
      }

      const result = analyzeImageType(data, width, height)

      // For small images, should return actual count (100)
      expect(result.uniqueColors).toBe(100)
    })
  })
})
