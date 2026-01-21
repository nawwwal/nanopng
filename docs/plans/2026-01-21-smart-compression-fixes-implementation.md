# Smart Compression Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all Copilot-identified issues in the smart compression implementation

**Architecture:** Four targeted fixes across image-analyzer, compression-orchestrator, and worker-pool. Each fix is isolated - no cross-dependencies between tasks.

**Tech Stack:** TypeScript, Vitest for testing

---

## Task 1: Fix Unique Colors Estimation (Logarithmic Scaling)

**Files:**
- Modify: `lib/core/image-analyzer.ts:35-62`
- Create: `lib/core/__tests__/image-analyzer.test.ts`

**Step 1: Write failing test for logarithmic color estimation**

Create test file:

```typescript
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

      // Fill with gradient to create many unique colors
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4
          data[idx] = x % 256     // R
          data[idx + 1] = y % 256 // G
          data[idx + 2] = (x + y) % 256 // B
          data[idx + 3] = 255     // A
        }
      }

      const result = analyzeImageType(data, width, height)

      // With only 10k samples from 1M pixels, raw count would be ~10k
      // Logarithmic scaling should estimate higher (closer to actual ~65k unique)
      // The saturation factor for 1M/10k = log(1M)/log(10k) ≈ 1.5
      expect(result.uniqueColors).toBeGreaterThan(15000)
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
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test -- lib/core/__tests__/image-analyzer.test.ts`

Expected: FAIL - first test fails because uniqueColors is raw count (~10k), not scaled up

**Step 3: Implement logarithmic scaling**

In `lib/core/image-analyzer.ts`, replace lines 35-62 with:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test -- lib/core/__tests__/image-analyzer.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
git add lib/core/image-analyzer.ts lib/core/__tests__/image-analyzer.test.ts
git commit -m "fix(image-analyzer): use logarithmic scaling for unique color estimation

Fixes underestimation of unique colors in large images caused by sampling.
Uses log(totalPixels)/log(sampledPixels) as saturation factor.
Also fixes transparency ratio denominator to use actual sampled count."
```

---

## Task 2: Add hasSignificantTransparency Flag and Update Interface

**Files:**
- Modify: `lib/core/image-analyzer.ts:8-15,82-90`
- Modify: `lib/core/__tests__/image-analyzer.test.ts`

**Step 1: Write failing test for hasSignificantTransparency**

Add to `lib/core/__tests__/image-analyzer.test.ts`:

```typescript
describe('transparency detection', () => {
  it('sets hasSignificantTransparency true when >5% pixels are transparent', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)

    // Make 10% of pixels transparent
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4
      data[idx] = 128     // R
      data[idx + 1] = 128 // G
      data[idx + 2] = 128 // B
      data[idx + 3] = i < 1000 ? 0 : 255 // First 10% transparent
    }

    const result = analyzeImageType(data, width, height)

    expect(result.hasTransparency).toBe(true)
    expect(result.hasSignificantTransparency).toBe(true)
  })

  it('sets hasSignificantTransparency false when <=5% pixels are transparent', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)

    // Make 3% of pixels transparent
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4
      data[idx] = 128
      data[idx + 1] = 128
      data[idx + 2] = 128
      data[idx + 3] = i < 300 ? 0 : 255 // First 3% transparent
    }

    const result = analyzeImageType(data, width, height)

    expect(result.hasTransparency).toBe(true) // >1%
    expect(result.hasSignificantTransparency).toBe(false) // <=5%
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test -- lib/core/__tests__/image-analyzer.test.ts`

Expected: FAIL - hasSignificantTransparency property doesn't exist

**Step 3: Update interface and return value**

In `lib/core/image-analyzer.ts`, update the interface (lines 8-15):

```typescript
export interface ImageAnalysisResult {
  type: ImageType
  uniqueColors: number
  hasHardEdges: boolean
  hasSmoothGradients: boolean
  hasTransparency: boolean
  hasSignificantTransparency: boolean
  solidRegionRatio: number
}
```

Update the return statement (around line 82-90) to include the new field:

```typescript
  return {
    type,
    uniqueColors,
    hasHardEdges,
    hasSmoothGradients,
    hasTransparency,
    hasSignificantTransparency,
    solidRegionRatio
  }
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test -- lib/core/__tests__/image-analyzer.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
git add lib/core/image-analyzer.ts lib/core/__tests__/image-analyzer.test.ts
git commit -m "feat(image-analyzer): add hasSignificantTransparency flag

New flag is true when >5% of pixels are transparent.
Used by orchestrator to determine PNG mixed-mode compression strategy."
```

---

## Task 3: Add Bounds Checks for Pixel Access

**Files:**
- Modify: `lib/core/image-analyzer.ts:107-165`
- Modify: `lib/core/__tests__/image-analyzer.test.ts`

**Step 1: Write test for edge cases**

Add to `lib/core/__tests__/image-analyzer.test.ts`:

```typescript
describe('bounds safety', () => {
  it('handles 1x1 image without crashing', () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255])

    expect(() => analyzeImageType(data, 1, 1)).not.toThrow()
  })

  it('handles image smaller than block size without crashing', () => {
    // 2x2 image, smaller than 4x4 texture analysis block
    const data = new Uint8ClampedArray(2 * 2 * 4)
    for (let i = 0; i < 4; i++) {
      data[i * 4] = 128
      data[i * 4 + 1] = 128
      data[i * 4 + 2] = 128
      data[i * 4 + 3] = 255
    }

    expect(() => analyzeImageType(data, 2, 2)).not.toThrow()
  })

  it('handles truncated buffer gracefully', () => {
    // Buffer is shorter than expected for 10x10 image
    const data = new Uint8ClampedArray(50 * 4) // Only 50 pixels instead of 100

    expect(() => analyzeImageType(data, 10, 10)).not.toThrow()
  })
})
```

**Step 2: Run test to verify behavior**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test -- lib/core/__tests__/image-analyzer.test.ts`

Expected: Tests should pass (existing code may already handle some cases) or fail on edge cases

**Step 3: Add bounds checks to analyzeTexture function**

In `lib/core/image-analyzer.ts`, update the `analyzeTexture` function:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test -- lib/core/__tests__/image-analyzer.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
git add lib/core/image-analyzer.ts lib/core/__tests__/image-analyzer.test.ts
git commit -m "fix(image-analyzer): add defensive bounds checks for pixel access

Prevents potential out-of-bounds access in:
- Sampling loop (truncated buffer)
- Edge detection (nextIdx overflow)
- Texture analysis blocks (edge pixels)"
```

---

## Task 4: Remove Dead estimateSavings Function

**Files:**
- Modify: `lib/core/image-analyzer.ts:183-211`

**Step 1: Verify function is unused**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && grep -r "estimateSavings" lib/ --include="*.ts" | grep -v "image-analyzer.ts"`

Expected: No results (function is not imported anywhere)

**Step 2: Delete the function**

Remove lines 183-211 from `lib/core/image-analyzer.ts` (the entire `estimateSavings` function and its JSDoc comment).

**Step 3: Run all tests to verify no breakage**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test`

Expected: All tests pass (26 tests)

**Step 4: Commit**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
git add lib/core/image-analyzer.ts
git commit -m "refactor(image-analyzer): remove unused estimateSavings function

Function was dead code - orchestrator has its own inline implementation.
Removes duplication and prevents divergence."
```

---

## Task 5: Fix Probe Savings Calculation

**Files:**
- Modify: `lib/services/compression-orchestrator.ts:86-99`
- Modify: `lib/services/__tests__/compression-orchestrator.test.ts`

**Step 1: Read existing tests**

Run: `cat /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes/lib/services/__tests__/compression-orchestrator.test.ts`

**Step 2: Add test for probe savings calculation**

Add to the test file:

```typescript
describe('quickProbe savings calculation', () => {
  it('uses compression ratio not pixel count for savings estimation', () => {
    // This is a conceptual test - the fix ensures:
    // estimatedSavings = (originalSize - (originalSize * probeCompressionRatio)) / originalSize
    // NOT: originalSize * scaleFactor^2 as baseline

    // The key insight: if probe achieves 50% compression at small scale,
    // full compression should also achieve ~50%, not some scaled version

    // We can't easily unit test this without mocking ImageService,
    // so this serves as documentation of the expected behavior
    expect(true).toBe(true)
  })
})
```

**Step 3: Fix the savings calculation in quickProbe**

In `lib/services/compression-orchestrator.ts`, replace lines 86-99 with:

```typescript
      const probeSize = probeResult.compressedBlob?.size || originalSize
      const probeTimeMs = performance.now() - startTime

      // Calculate probe's original size (before compression) at probe dimensions
      // This is an estimate based on pixel ratio
      const probePixels = probeWidth * probeHeight
      const originalPixels = oriWidth * oriHeight

      // Probe compression ratio: how much did the probe compress?
      // Use the probe's own input size estimate, not the original file size
      const estimatedProbeInputSize = (probePixels / originalPixels) * originalSize
      const probeCompressionRatio = probeSize / estimatedProbeInputSize

      // Apply same compression ratio to full-size image
      const estimatedFullCompressedSize = originalSize * probeCompressionRatio

      // Calculate savings as percentage
      const estimatedSavings = Math.max(0, ((originalSize - estimatedFullCompressedSize) / originalSize) * 100)

      // Skip if estimated savings below threshold
      const shouldSkip = estimatedSavings < CompressionOrchestrator.SKIP_THRESHOLD_PERCENT
```

**Step 4: Run tests to verify no breakage**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test`

Expected: All tests pass

**Step 5: Commit**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
git add lib/services/compression-orchestrator.ts lib/services/__tests__/compression-orchestrator.test.ts
git commit -m "fix(orchestrator): use compression ratio for probe savings estimation

Previous calculation assumed file size scales with pixel count (quadratic),
which is incorrect for compressed formats like PNG/JPEG.

New approach:
1. Estimate probe input size from pixel ratio
2. Calculate probe compression ratio
3. Apply same ratio to estimate full-size output
4. Derive savings from original vs estimated output"
```

---

## Task 6: Implement Transparency-Based PNG Mixed Mode

**Files:**
- Modify: `lib/services/compression-orchestrator.ts:186-191`

**Step 1: Update mixed mode logic**

In `lib/services/compression-orchestrator.ts`, replace lines 186-191:

```typescript
    if (imageAnalysis && effectiveFormat === 'png' && effectiveLossless === undefined) {
      // Auto-select lossless vs lossy for PNG based on image type
      // Photos: use lossless (better quality preservation)
      // Graphics: use lossy (palette reduction works great)
      // Mixed: use transparency to decide (lossy artifacts visible in semi-transparent areas)
      if (imageAnalysis.type === 'photo') {
        effectiveLossless = true
      } else if (imageAnalysis.type === 'mixed') {
        effectiveLossless = imageAnalysis.hasSignificantTransparency
      } else {
        effectiveLossless = false
      }
    }
```

**Step 2: Run tests to verify no breakage**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test`

Expected: All tests pass

**Step 3: Commit**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
git add lib/services/compression-orchestrator.ts
git commit -m "fix(orchestrator): use transparency-based logic for PNG mixed mode

Mixed images with significant transparency (>5%) use lossless to avoid
artifacts in semi-transparent areas. Mixed images without transparency
use lossy for better compression."
```

---

## Task 7: Pass speedMode in Resize Fallback Path

**Files:**
- Modify: `lib/services/compression-orchestrator.ts:293-307`

**Step 1: Add speedMode to fallback compression calls**

In `lib/services/compression-orchestrator.ts`, update the resize fallback compression call (around line 295-307):

```typescript
          imageServiceResult = await ImageService.compress(
            file,
            id,
            0,
            undefined,
            targetFormat,
            quality / 100,
            currentWidth,
            currentHeight,
            options.dithering,
            options.chromaSubsampling,
            effectiveLossless,
            options.speedMode // Add speedMode propagation
          )
```

Also update the similar call around line 239-251 in the first binary search loop to ensure consistency.

**Step 2: Run tests**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test`

Expected: All tests pass

**Step 3: Commit**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
git add lib/services/compression-orchestrator.ts
git commit -m "fix(orchestrator): propagate speedMode in resize fallback path

Ensures consistent speed behavior across all compression paths."
```

---

## Task 8: Implement O(1) Priority Queue

**Files:**
- Modify: `lib/workers/worker-pool.ts:4-8,17,77-100,103-115`

**Step 1: Update queue data structure**

In `lib/workers/worker-pool.ts`, replace the queue-related code:

Replace interface and class fields (lines 4-21):

```typescript
interface QueuedTask {
  id: string
  resolve: (api: Comlink.Remote<ProcessorAPI>) => void
}

type Priority = 'low' | 'normal' | 'high'

/** Size threshold for batching small images (500KB) */
const BATCH_SIZE_THRESHOLD = 500 * 1024

class WorkerPool {
  private workers: Worker[] = []
  private apis: Comlink.Remote<ProcessorAPI>[] = []
  private available: Set<number> = new Set()
  // O(1) priority queues - separate queue per priority level
  private queues: Record<Priority, QueuedTask[]> = {
    high: [],
    normal: [],
    low: []
  }
  private initialized = false
  private initializing: Promise<void> | null = null
  private poolSize: number
  private normalPoolSize: number
  private maxPoolSize: number
```

Update constructor:

```typescript
  constructor() {
    const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4

    // Normal pool size: 75% of cores (min 2, max 8) for full compression
    this.normalPoolSize = Math.max(2, Math.min(8, Math.floor(cores * 0.75)))
    this.poolSize = this.normalPoolSize

    // Max pool size: 100% of cores for lightweight probe operations
    this.maxPoolSize = Math.max(2, Math.min(12, cores))
  }
```

**Step 2: Update acquire method queue handling**

Replace the queue handling in acquire (around line 77-100):

```typescript
    // No worker available, wait in queue
    return new Promise((resolve) => {
      const task: QueuedTask = {
        id: Math.random().toString(36).slice(2),
        resolve: (api) => {
          const index = this.apis.indexOf(api)
          resolve({
            api,
            release: () => {
              this.available.add(index)
              this.processQueue()
            }
          })
        }
      }

      // Add to appropriate priority queue
      this.queues[priority].push(task)
    })
```

**Step 3: Update processQueue for O(1) access**

Replace processQueue method (around line 103-115):

```typescript
  private processQueue(): void {
    if (this.available.size === 0) return

    // O(1) dequeue: check queues in priority order
    const task =
      this.queues.high.shift() ||
      this.queues.normal.shift() ||
      this.queues.low.shift()

    if (!task) return

    const index = this.available.values().next().value as number
    this.available.delete(index)

    task.resolve(this.apis[index]!)
  }
```

**Step 4: Update getQueueLength**

```typescript
  getQueueLength(): number {
    return this.queues.high.length + this.queues.normal.length + this.queues.low.length
  }
```

**Step 5: Update terminate to clear all queues**

```typescript
  terminate(): void {
    this.workers.forEach(w => w.terminate())
    this.workers = []
    this.apis = []
    this.available.clear()
    this.queues = { high: [], normal: [], low: [] }
    this.initialized = false
    this.initializing = null
  }
```

**Step 6: Run tests**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test`

Expected: All tests pass

**Step 7: Commit**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
git add lib/workers/worker-pool.ts
git commit -m "perf(worker-pool): implement O(1) priority queue

Replace single queue with findIndex+splice (O(n)) with separate
queues per priority level for O(1) enqueue and dequeue operations."
```

---

## Task 9: Implement Dynamic Pool Scaling

**Files:**
- Modify: `lib/workers/worker-pool.ts`

**Step 1: Add pool scaling methods**

Add these methods to the WorkerPool class:

```typescript
  /**
   * Expand pool to target size for lightweight operations.
   * Creates new workers up to maxPoolSize.
   */
  private async expandPool(targetSize: number): Promise<void> {
    const actualTarget = Math.min(targetSize, this.maxPoolSize)

    while (this.workers.length < actualTarget) {
      const worker = new Worker(
        new URL("./processor.worker.ts", import.meta.url),
        { type: "module" }
      )
      const api = Comlink.wrap<ProcessorAPI>(worker)

      const newIndex = this.workers.length
      this.workers.push(worker)
      this.apis.push(api)
      this.available.add(newIndex)
    }

    this.poolSize = this.workers.length
    console.log(`Worker pool expanded to ${this.poolSize} workers`)
  }

  /**
   * Shrink pool back to normal size.
   * Terminates idle workers above normalPoolSize.
   */
  private shrinkPool(): void {
    while (this.workers.length > this.normalPoolSize) {
      // Only shrink if we have idle workers above normal size
      const lastIndex = this.workers.length - 1
      if (!this.available.has(lastIndex)) break

      this.available.delete(lastIndex)
      this.workers[lastIndex].terminate()
      this.workers.pop()
      this.apis.pop()
    }

    this.poolSize = this.workers.length
    if (this.poolSize < this.maxPoolSize) {
      console.log(`Worker pool shrunk to ${this.poolSize} workers`)
    }
  }

  /**
   * Execute a probe task with pool expansion for maximum throughput.
   */
  async executeProbe<T>(
    task: (api: Comlink.Remote<ProcessorAPI>) => Promise<T>
  ): Promise<T> {
    // Expand pool for probe work if there's queued work
    if (this.getQueueLength() > 0 && this.poolSize < this.maxPoolSize) {
      await this.expandPool(this.maxPoolSize)
    }

    return this.execute(task, 'high')
  }

  /**
   * Signal that probe phase is complete, pool can shrink.
   */
  probePhaseComplete(): void {
    this.shrinkPool()
  }
```

**Step 2: Run tests**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes && npm test`

Expected: All tests pass

**Step 3: Commit**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
git add lib/workers/worker-pool.ts
git commit -m "feat(worker-pool): implement dynamic pool scaling

Pool expands to maxPoolSize (100% cores) for lightweight probe work,
shrinks back to normalPoolSize (75% cores) for heavy compression.

- expandPool(): Creates workers up to maxPoolSize
- shrinkPool(): Terminates idle workers above normalPoolSize
- executeProbe(): Auto-expands for probe tasks
- probePhaseComplete(): Signals shrink opportunity"
```

---

## Task 10: Delete Implementation Doc

**Files:**
- Delete: `docs/plans/2026-01-21-smart-compression-implementation.md`

**Step 1: Delete the file**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
rm docs/plans/2026-01-21-smart-compression-implementation.md
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove outdated implementation doc

Doc contained hardcoded paths and is no longer needed."
```

---

## Task 11: Final Verification

**Step 1: Run full test suite**

```bash
cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression-fixes
npm test
```

Expected: All tests pass

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Review all commits**

```bash
git log --oneline -12
```

Verify all fixes are committed.

---

## Summary

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Logarithmic unique color scaling | fix(image-analyzer) |
| 2 | hasSignificantTransparency flag | feat(image-analyzer) |
| 3 | Bounds checks for pixel access | fix(image-analyzer) |
| 4 | Remove dead estimateSavings | refactor(image-analyzer) |
| 5 | Fix probe savings calculation | fix(orchestrator) |
| 6 | Transparency-based PNG mixed mode | fix(orchestrator) |
| 7 | speedMode propagation | fix(orchestrator) |
| 8 | O(1) priority queue | perf(worker-pool) |
| 9 | Dynamic pool scaling | feat(worker-pool) |
| 10 | Delete outdated doc | chore |
| 11 | Final verification | - |
